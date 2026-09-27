import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Radio, RefreshCw, ShieldCheck, Smartphone, Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  connect,
  disconnect,
  ensureSession,
  pairingUrl,
  rotateSession,
  setRelayUrl,
  useStation,
} from "@/lib/nfc/station-store";

const statusLabel: Record<string, { text: string; dot: string; badge: string }> = {
  connected: {
    text: "Connected",
    dot: "text-[var(--color-signal-online)]",
    badge: "bg-[color-mix(in_oklab,var(--color-signal-online)_18%,transparent)] text-[var(--color-signal-online)]",
  },
  connecting: {
    text: "Handshaking…",
    dot: "text-[var(--color-signal-warn)]",
    badge: "bg-[color-mix(in_oklab,var(--color-signal-warn)_18%,transparent)] text-[var(--color-signal-warn)]",
  },
  disconnected: {
    text: "Disconnected",
    dot: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  },
  error: {
    text: "Link error",
    dot: "text-[var(--color-signal-block)]",
    badge: "bg-[color-mix(in_oklab,var(--color-signal-block)_18%,transparent)] text-[var(--color-signal-block)]",
  },
};

export function PairingHeader() {
  const status = useStation((s) => s.status);
  const engineOnline = useStation((s) => s.mobileEngineOnline);
  const relayUrl = useStation((s) => s.relayUrl);
  const token = useStation((s) => s.token);
  const socketId = useStation((s) => s.socketId);
  const lastError = useStation((s) => s.lastError);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    ensureSession();
  }, []);

  const url = pairingUrl();
  const mobileUrl = useMemo(() => {
    if (typeof window === "undefined" || !token) return "";
    const origin = window.location.origin;
    return `${origin}/mobile?relay=${encodeURIComponent(relayUrl)}&token=${token}`;
  }, [relayUrl, token]);

  const meta = statusLabel[status] ?? statusLabel["disconnected"]!;

  return (
    <header className="panel bg-[var(--color-midnight)]/80 backdrop-blur">
      <div className="flex flex-wrap items-center gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-[var(--color-indigo-accent)]/15 p-2 text-[var(--color-indigo-accent)]">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              NFC · Dual-Device Station
            </p>
            <p className="text-lg font-semibold leading-tight">Desktop Command Deck</p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <StatusPill
            icon={status === "connected" ? Wifi : WifiOff}
            label={`Relay · ${meta.text}`}
            className={meta.badge}
            dotClassName={meta.dot}
          />
          <StatusPill
            icon={Smartphone}
            label={engineOnline ? "Mobile engine · online" : "Mobile engine · waiting"}
            className={
              engineOnline
                ? "bg-[color-mix(in_oklab,var(--color-signal-online)_18%,transparent)] text-[var(--color-signal-online)]"
                : "bg-muted text-muted-foreground"
            }
            dotClassName={
              engineOnline ? "text-[var(--color-signal-online)]" : "text-muted-foreground"
            }
          />
          {socketId && (
            <span className="mono rounded-md border border-panel-border/60 px-2 py-1 text-[10px] text-muted-foreground">
              sid {socketId.slice(0, 8)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {status === "connected" ? (
            <Button size="sm" variant="secondary" onClick={disconnect}>
              Disconnect
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={connect}>
              Connect relay
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                Pair Mobile Engine
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Pair Mobile Engine</DialogTitle>
                <DialogDescription>
                  Scan the QR from an Android device running Web NFC (Chrome) — the URL carries a
                  short-lived session token bound to your relay socket.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
                <div className="mx-auto shrink-0 rounded-md bg-white p-3">
                  {mobileUrl ? (
                    <QRCodeSVG
                      value={mobileUrl}
                      size={220}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                      aria-label="Pairing QR"
                    />
                  ) : (
                    <div className="flex h-[220px] w-[220px] items-center justify-center text-xs text-muted-foreground">
                      Preparing QR…
                    </div>
                  )}
                </div>
                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Relay URL
                    </Label>
                    <Input
                      value={relayUrl}
                      onChange={(e) => setRelayUrl(e.target.value)}
                      className="mono h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      WebSocket token
                    </Label>
                    <div className="mono truncate rounded-md border border-panel-border bg-[var(--color-surface)] px-2 py-1 text-[11px]">
                      {token || "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Mobile URL
                    </Label>
                    <div className="mono max-h-16 overflow-hidden overflow-y-auto rounded-md border border-panel-border bg-[var(--color-surface)] p-2 text-[11px] text-muted-foreground">
                      {mobileUrl || url || "—"}
                    </div>
                  </div>
                  {lastError && (
                    <p className="rounded-md border border-[var(--color-signal-block)]/40 bg-[var(--color-signal-block)]/10 p-2 text-[11px] text-[var(--color-signal-block)]">
                      {lastError}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="ghost" size="sm" onClick={rotateSession} className="gap-1">
                  <RefreshCw className="h-3.5 w-3.5" /> Rotate token
                </Button>
                <Button size="sm" onClick={connect}>
                  Open relay socket
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}

function StatusPill({
  icon: Icon,
  label,
  className,
  dotClassName,
}: {
  icon: typeof Wifi;
  label: string;
  className?: string;
  dotClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium",
        className,
      )}
    >
      <span className={cn("signal-dot", dotClassName)} />
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}
