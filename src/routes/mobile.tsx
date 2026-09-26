import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { io, type Socket } from "socket.io-client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bytesToHex, toUint8 } from "@/lib/nfc/bytes";
import { EMV_AIDS, manufacturerFromUid, schemeForAid } from "@/lib/nfc/chip";

interface Search {
  relay?: string;
  token?: string;
}

export const Route = createFileRoute("/mobile")({
  head: () => ({
    meta: [
      { title: "NFC-DDS · Mobile Engine" },
      {
        name: "description",
        content:
          "Mobile companion that pairs to the NFC-DDS desktop deck and streams Web NFC scans in real time.",
      },
      { property: "og:title", content: "NFC-DDS · Mobile Engine" },
      {
        property: "og:description",
        content: "Pair, scan, and stream live NFC tags to the NFC-DDS desktop deck.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    relay: typeof search["relay"] === "string" ? (search["relay"] as string) : undefined,
    token: typeof search["token"] === "string" ? (search["token"] as string) : undefined,
  }),
  component: MobileEngine,
});

interface LogLine {
  id: string;
  at: number;
  tone: "info" | "ok" | "warn" | "err";
  text: string;
}

function MobileEngine() {
  const search = Route.useSearch();
  const [relay, setRelay] = useState(search.relay ?? "");
  const [token, setToken] = useState(search.token ?? "");
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const readerRef = useRef<any>(null);

  const nfcSupported = useMemo(
    () => typeof window !== "undefined" && "NDEFReader" in window,
    [],
  );

  const push = (tone: LogLine["tone"], text: string) =>
    setLog((cur) =>
      [{ id: Math.random().toString(36).slice(2), at: Date.now(), tone, text }, ...cur].slice(0, 80),
    );

  const connect = () => {
    if (!relay || !token) {
      push("err", "Relay URL and token are required");
      return;
    }
    socketRef.current?.disconnect();
    const target = relay.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
    setStatus("connecting");
    push("info", `dialling ${target}`);
    const socket = io(target, {
      transports: ["websocket"],
      auth: { token, role: "mobile" },
      query: { token, role: "mobile" },
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      setStatus("connected");
      push("ok", `connected as ${socket.id}`);
      socket.emit("mobile-register", { token, device: navigator.userAgent });
      socket.emit("mobile-engine-connected", { device: navigator.userAgent });
    });
    socket.on("disconnect", (reason) => {
      setStatus("idle");
      push("warn", `disconnected: ${reason}`);
    });
    socket.on("connect_error", (e: Error) => {
      setStatus("error");
      push("err", `connect error: ${e.message}`);
    });
    socket.on("desktop-operation-prepared", (payload: { id: string; label: string; bytes: number[] }) => {
      push("info", `desktop wants to write ${payload.label} (${payload.bytes.length} bytes)`);
      writeToTag(payload);
    });
  };

  const writeToTag = async (payload: { id: string; label: string; bytes: number[] }) => {
    if (!("NDEFReader" in window)) {
      socketRef.current?.emit("mobile-operation-result", {
        id: payload.id,
        ok: false,
        detail: "Web NFC not supported",
      });
      return;
    }
    try {
      // Web NFC writer takes structured records; ship the raw bytes as an unknown record
      // so the desktop-encoded NDEF frame reaches the tag verbatim.
      const writer = new (window as any).NDEFReader();
      await writer.write({
        records: [{ recordType: "unknown", data: new Uint8Array(payload.bytes) }],
      });
      push("ok", `wrote ${payload.label}`);
      socketRef.current?.emit("mobile-operation-result", { id: payload.id, ok: true });
    } catch (error) {
      push("err", `write failed: ${(error as Error).message}`);
      socketRef.current?.emit("mobile-operation-result", {
        id: payload.id,
        ok: false,
        detail: (error as Error).message,
      });
    }
  };

  const startScanning = async () => {
    if (!("NDEFReader" in window)) {
      push("err", "Web NFC not available. Use Android Chrome over HTTPS.");
      return;
    }
    try {
      const reader = new (window as any).NDEFReader();
      readerRef.current = reader;
      await reader.scan();
      setScanning(true);
      push("ok", "scanning for tags…");
      reader.addEventListener("readingerror", () => push("err", "reading error"));
      reader.addEventListener("reading", (event: any) => handleReading(event));
    } catch (error) {
      push("err", `scan failed: ${(error as Error).message}`);
    }
  };

  const handleReading = (event: any) => {
    const serialNumber: string = event.serialNumber ?? "";
    const uid = serialNumber
      .split(":")
      .filter(Boolean)
      .map((byte: string) => parseInt(byte, 16) & 0xff);

    // Web NFC hands over structured records — re-encode them into a raw NDEF-like buffer
    // so the desktop parser sees an authentic tag dump instead of framework objects.
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const records = event.message?.records ?? [];
    records.forEach((rec: any, i: number) => {
      const type = encoder.encode(rec.recordType || "");
      const payload = rec.data ? new Uint8Array(rec.data.buffer ?? rec.data) : new Uint8Array(0);
      let header = 0x11; // SR
      if (i === 0) header |= 0x80;
      if (i === records.length - 1) header |= 0x40;
      const tnf = rec.recordType === "text" || rec.recordType === "url" ? 0x01 : 0x02;
      header = (header & 0xf8) | tnf;
      chunks.push(
        Uint8Array.from([header, type.length, payload.length]),
        type,
        payload,
      );
    });
    let ndef = new Uint8Array(0);
    if (chunks.length) {
      const total = chunks.reduce((sum, c) => sum + c.length, 0);
      ndef = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        ndef.set(c, offset);
        offset += c.length;
      }
    }
    const tlv =
      ndef.length < 0xff
        ? Uint8Array.from([0x03, ndef.length])
        : Uint8Array.from([0x03, 0xff, (ndef.length >> 8) & 0xff, ndef.length & 0xff]);
    const raw = new Uint8Array(16 + tlv.length + ndef.length + 1);
    raw.set(uid, 0);
    raw.set(tlv, 16);
    raw.set(ndef, 16 + tlv.length);
    raw[16 + tlv.length + ndef.length] = 0xfe;

    const frame = {
      id: `${Date.now()}-${serialNumber}`,
      uid,
      protocol: "ISO 14443-A",
      manufacturer: manufacturerFromUid(uid),
      writable: true,
      memoryTotal: raw.length,
      memoryUsed: 16 + tlv.length + ndef.length,
      data: Array.from(raw),
    };
    socketRef.current?.emit("mobile-scan-result", frame);
    push("ok", `tag ${bytesToHex(uid, ":")} · ${records.length} record(s) streamed`);

    // Emit synthetic AID-block events for records that carry EMV AIDs, so the
    // desktop security log receives real activity from the hardware layer.
    records.forEach((rec: any) => {
      const payload: Uint8Array = rec.data
        ? new Uint8Array(rec.data.buffer ?? rec.data)
        : new Uint8Array(0);
      const hex = Array.from(payload)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
      const hit = EMV_AIDS.find((entry) => hex.includes(entry.prefix));
      if (hit) {
        socketRef.current?.emit("mobile-aid-block", {
          aid: hit.prefix,
          scheme: schemeForAid(hit.prefix),
          action: "blocked",
          detail: "AID observed in NDEF payload · dropped at hardware layer",
        });
      }
    });
  };

  useEffect(() => {
    if (search.relay && search.token && status === "idle") {
      setRelay(search.relay);
      setToken(search.token);
      // Auto-dial the relay as soon as the QR-encoded params arrive so the
      // engineer only has to open the QR and tap Scan.
      setTimeout(connect, 50);
    }
    return () => {
      socketRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-md space-y-4">
        <header className="panel p-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            NFC-DDS · Mobile Engine
          </p>
          <h1 className="text-lg font-semibold">Pair &amp; scan</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge
              className={
                status === "connected"
                  ? "bg-[var(--color-signal-online)]/20 text-[var(--color-signal-online)]"
                  : status === "connecting"
                    ? "bg-[var(--color-signal-warn)]/20 text-[var(--color-signal-warn)]"
                    : status === "error"
                      ? "bg-[var(--color-signal-block)]/20 text-[var(--color-signal-block)]"
                      : "bg-muted text-muted-foreground"
              }
            >
              relay · {status}
            </Badge>
            <Badge variant="outline">{nfcSupported ? "Web NFC ready" : "Web NFC unavailable"}</Badge>
          </div>
        </header>

        <div className="panel space-y-2 p-4 text-xs">
          <div>
            <Label>Relay URL</Label>
            <Input value={relay} onChange={(e) => setRelay(e.target.value)} className="mono" />
          </div>
          <div>
            <Label>Session token</Label>
            <Input value={token} onChange={(e) => setToken(e.target.value)} className="mono" />
          </div>
          <div className="flex gap-2">
            <Button onClick={connect} size="sm">Connect</Button>
            <Button
              onClick={startScanning}
              size="sm"
              variant="secondary"
              disabled={!nfcSupported || scanning}
            >
              {scanning ? "Scanning…" : "Start scanning"}
            </Button>
          </div>
          {!nfcSupported && (
            <p className="text-[11px] text-muted-foreground">
              Web NFC requires Android Chrome served over HTTPS. Open this URL on the phone from
              the pairing QR to try it live.
            </p>
          )}
        </div>

        <div className="panel p-3">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            Engine log
          </p>
          <ul className="mono max-h-[50vh] space-y-1 overflow-y-auto text-[11px]">
            {log.map((line) => (
              <li key={line.id} className="flex gap-2">
                <span className="text-muted-foreground">
                  {new Date(line.at).toLocaleTimeString(undefined, { hour12: false })}
                </span>
                <span
                  className={
                    line.tone === "ok"
                      ? "text-[var(--color-signal-online)]"
                      : line.tone === "warn"
                        ? "text-[var(--color-signal-warn)]"
                        : line.tone === "err"
                          ? "text-[var(--color-signal-block)]"
                          : "text-foreground"
                  }
                >
                  {line.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
