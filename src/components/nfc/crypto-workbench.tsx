import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, Lock, Sparkles } from "lucide-react";
import CryptoJS from "crypto-js";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CryptoResult } from "@/lib/nfc/crypto-worker";
import { useCryptoWorker } from "@/lib/nfc/use-crypto-worker";
import { activeScan, useStation } from "@/lib/nfc/station-store";

interface LogLine {
  id: string;
  at: number;
  text: string;
  tone: "info" | "ok" | "warn" | "err";
}

const DEFAULT_LIST = [
  "password",
  "1234",
  "letmein",
  "nfc-dds",
  "admin",
  "correct horse battery staple",
  "opensesame",
  "trustno1",
];

export function CryptoWorkbench() {
  const scan = useStation((s) => activeScan(s));
  const [entropy, setEntropy] = useState<{ value: number; classification: string; len: number } | null>(
    null,
  );
  const [cipher, setCipher] = useState<"AES-128" | "AES-256" | "3DES">("AES-256");
  const [ciphertext, setCiphertext] = useState("");
  const [passphrase, setPassphrase] = useState("nfc-dds");
  const [wordlist, setWordlist] = useState(DEFAULT_LIST.join("\n"));
  const [progress, setProgress] = useState<{ tried: number; total: number; current: string } | null>(
    null,
  );
  const [log, setLog] = useState<LogLine[]>([]);
  const jobId = useRef(0);

  const appendLog = useCallback((tone: LogLine["tone"], text: string) => {
    setLog((cur) =>
      [{ id: Math.random().toString(36).slice(2), at: Date.now(), tone, text }, ...cur].slice(0, 60),
    );
  }, []);

  const handleMessage = useCallback(
    (msg: CryptoResult) => {
      if (msg.type === "entropy") {
        setEntropy({ value: msg.entropy, classification: msg.classification, len: msg.length });
        appendLog(
          msg.entropy > 7.4 ? "warn" : "info",
          `entropy ${msg.entropy.toFixed(3)} bpB · ${msg.classification} (${msg.length} bytes)`,
        );
      }
      if (msg.type === "brute-progress") {
        setProgress({ tried: msg.tried, total: msg.total, current: msg.current });
      }
      if (msg.type === "brute-result") {
        setProgress(null);
        if (msg.matched) {
          appendLog("ok", `key recovered: "${msg.matched}" → ${msg.preview?.slice(0, 60)}`);
        } else {
          appendLog("warn", `no match after ${msg.tried} attempts`);
        }
      }
      if (msg.type === "decrypt") {
        appendLog(
          msg.ok ? "ok" : "err",
          msg.ok
            ? `single decrypt · preview "${msg.preview.slice(0, 80)}"`
            : `single decrypt failed`,
        );
      }
      if (msg.type === "error") appendLog("err", msg.message);
    },
    [appendLog],
  );

  const worker = useCryptoWorker(handleMessage);

  const analyseScan = useCallback(() => {
    if (!scan) return;
    const id = `entropy-${++jobId.current}`;
    worker.post({ type: "entropy", jobId: id, bytes: Array.from(scan.raw) });
    appendLog("info", `entropy job dispatched for scan ${scan.id.slice(0, 6)}`);
  }, [scan, worker, appendLog]);

  // Auto-analyse every new tag scan.
  useEffect(() => {
    if (scan) analyseScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan?.id]);

  const suggestedCiphertext = useMemo(() => {
    if (!scan) return "";
    const wa = CryptoJS.lib.WordArray.create(scan.raw as unknown as number[]);
    return CryptoJS.enc.Base64.stringify(wa);
  }, [scan]);

  const runBrute = () => {
    if (!ciphertext.trim()) {
      appendLog("err", "paste base64 ciphertext first");
      return;
    }
    const passphrases = wordlist
      .split(/\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (passphrases.length === 0) {
      appendLog("err", "wordlist is empty");
      return;
    }
    const id = `brute-${++jobId.current}`;
    setProgress({ tried: 0, total: passphrases.length, current: "" });
    appendLog(
      "info",
      `dispatched brute over ${passphrases.length} candidates against ${cipher}`,
    );
    worker.post({ type: "brute", jobId: id, cipher, ciphertextBase64: ciphertext.trim(), passphrases });
  };

  const runSingle = () => {
    if (!ciphertext.trim()) return;
    const id = `dec-${++jobId.current}`;
    worker.post({
      type: "decrypt",
      jobId: id,
      cipher,
      ciphertextBase64: ciphertext.trim(),
      passphrase,
    });
  };

  return (
    <Card className="panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <KeyRound className="h-4 w-4 text-[var(--color-indigo-accent)]" /> Multithreaded Cryptographic
          Workbench
          <span className="ml-auto text-[11px] text-muted-foreground">
            worker · off main thread
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <div className="rounded-md border border-panel-border bg-[var(--color-surface)]/60 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Entropy analysis
              </p>
              <Button size="sm" variant="ghost" onClick={analyseScan} disabled={!scan} className="gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Re-run
              </Button>
            </div>
            {entropy ? (
              <>
                <div className="mono mt-2 text-2xl">{entropy.value.toFixed(3)} bpB</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {entropy.classification} · {entropy.len} bytes
                </div>
                <Progress value={(entropy.value / 8) * 100} className="mt-2 h-1.5" />
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Scan a tag or paste ciphertext to run Shannon entropy on the buffer.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <Label>Cipher</Label>
              <Select value={cipher} onValueChange={(v) => setCipher(v as any)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AES-128">AES-128-CBC</SelectItem>
                  <SelectItem value="AES-256">AES-256-CBC</SelectItem>
                  <SelectItem value="3DES">Triple DES</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Single passphrase</Label>
              <Input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className="mono h-9" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Ciphertext (base64)</Label>
              <Button size="sm" variant="ghost" onClick={() => setCiphertext(suggestedCiphertext)} disabled={!suggestedCiphertext}>
                Use current scan
              </Button>
            </div>
            <Textarea
              value={ciphertext}
              onChange={(e) => setCiphertext(e.target.value)}
              rows={3}
              className="mono text-[11px]"
            />
          </div>

          <div>
            <Label>Passphrase list (one per line)</Label>
            <Textarea
              value={wordlist}
              onChange={(e) => setWordlist(e.target.value)}
              rows={5}
              className="mono text-[11px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={runBrute} className="gap-2">
              <Lock className="h-4 w-4" /> Iterate wordlist
            </Button>
            <Button onClick={runSingle} variant="secondary">Try passphrase</Button>
            {progress && (
              <div className="ml-auto text-[11px] text-muted-foreground">
                {progress.tried}/{progress.total} · {progress.current}
              </div>
            )}
          </div>
          {progress && <Progress value={(progress.tried / progress.total) * 100} className="h-1.5" />}
        </div>

        <div className="rounded-md border border-panel-border bg-[var(--color-surface)]/60">
          <div className="border-b border-panel-border/70 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Worker output
          </div>
          <ScrollArea className="h-[420px]">
            {log.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">Worker idle.</p>
            ) : (
              <ul className="mono divide-y divide-panel-border/60 text-[11px]">
                {log.map((line) => (
                  <li key={line.id} className="flex gap-2 px-3 py-1.5">
                    <span className="text-muted-foreground">
                      {new Date(line.at).toLocaleTimeString(undefined, { hour12: false })}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        line.tone === "ok"
                          ? "border-[var(--color-signal-online)]/40 text-[var(--color-signal-online)]"
                          : line.tone === "warn"
                            ? "border-[var(--color-signal-warn)]/40 text-[var(--color-signal-warn)]"
                            : line.tone === "err"
                              ? "border-[var(--color-signal-block)]/40 text-[var(--color-signal-block)]"
                              : "border-panel-border"
                      }
                    >
                      {line.tone}
                    </Badge>
                    <span className="break-all text-foreground">{line.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
