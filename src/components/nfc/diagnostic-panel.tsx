import { useMemo } from "react";
import { Cpu, Fingerprint, HardDrive, Radar } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { HexViewer } from "./hex-viewer";
import { MemoryMeter } from "./memory-meter";
import { bytesToHex } from "@/lib/nfc/bytes";
import { activeScan, selectScan, useStation } from "@/lib/nfc/station-store";
import type { TagScan } from "@/lib/nfc/types";
import { cn } from "@/lib/utils";

export function DiagnosticPanel() {
  const scans = useStation((s) => s.scans);
  const active = useStation((s) => activeScan(s));

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <ScanRail scans={scans} activeId={active?.id ?? null} />
      <div className="grid gap-4">
        <TagProperties scan={active} />
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <MemoryCard scan={active} />
          <NdefCard scan={active} />
        </div>
        <HexDumpCard scan={active} />
      </div>
    </div>
  );
}

function ScanRail({ scans, activeId }: { scans: TagScan[]; activeId: string | null }) {
  return (
    <Card className="panel bg-[var(--color-panel)]/80">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Radar className="h-4 w-4 text-[var(--color-indigo-accent)]" /> Recent scans
          <Badge variant="secondary" className="ml-auto">
            {scans.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[560px]">
          {scans.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">
              Waiting for <span className="mono">mobile-scan-result</span> frames from the paired
              engine.
            </p>
          ) : (
            <ul className="divide-y divide-panel-border/70">
              {scans.map((scan) => {
                const uidHex = bytesToHex(scan.uid, ":") || "—";
                const isActive = scan.id === activeId;
                return (
                  <li key={scan.id}>
                    <button
                      type="button"
                      onClick={() => selectScan(scan.id)}
                      className={cn(
                        "flex w-full flex-col gap-1 px-3 py-2 text-left transition",
                        isActive
                          ? "bg-[var(--color-indigo-accent)]/12"
                          : "hover:bg-[var(--color-surface)]/70",
                      )}
                    >
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="mono">{uidHex}</span>
                        <span>{formatTime(scan.receivedAt)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate text-foreground">{scan.manufacturer}</span>
                        <span className="mono text-muted-foreground">{scan.raw.length}B</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="border-panel-border px-1.5 py-0">
                          {scan.protocol}
                        </Badge>
                        <span>{scan.records.length} record(s)</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function TagProperties({ scan }: { scan: TagScan | null }) {
  const uidHex = scan ? bytesToHex(scan.uid, ":") : "—";
  return (
    <Card className="panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Fingerprint className="h-4 w-4 text-[var(--color-indigo-accent)]" />
          Physical properties
          {scan && (
            <Badge className="ml-auto bg-[var(--color-signal-online)]/15 text-[var(--color-signal-online)]">
              live
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm md:grid-cols-3">
        <Field label="UID" value={uidHex} mono />
        <Field label="Manufacturer" value={scan?.manufacturer ?? "—"} />
        <Field label="Protocol" value={scan?.protocol ?? "—"} />
        <Field label="Tag type" value={scan?.tagType ?? "—"} />
        <Field label="ATQA" value={scan?.atqa ?? "—"} mono />
        <Field label="SAK" value={scan?.sak ?? "—"} mono />
        <Field label="Writable" value={scan ? (scan.writable ? "yes" : "no") : "—"} />
        <Field label="Received" value={scan ? new Date(scan.receivedAt).toLocaleString() : "—"} />
        <Field
          label="Records"
          value={scan ? `${scan.records.length} · ${scan.parseError ?? "parsed"}` : "—"}
        />
      </CardContent>
    </Card>
  );
}

function MemoryCard({ scan }: { scan: TagScan | null }) {
  const segments = useMemo(() => {
    if (!scan) return [];
    const out: Array<{ start: number; end: number; label: string }> = [];
    if (scan.ndefOffset > 0) out.push({ start: 0, end: scan.ndefOffset, label: "Header / CC" });
    let cursor = scan.ndefOffset;
    scan.records.forEach((record, i) => {
      out.push({
        start: cursor,
        end: cursor + record.byteLength,
        label: `Record ${i + 1} · ${record.kind}`,
      });
      cursor += record.byteLength;
    });
    if (cursor < scan.raw.length) {
      out.push({ start: cursor, end: scan.raw.length, label: "Free / lock bytes" });
    }
    return out;
  }, [scan]);

  return (
    <Card className="panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <HardDrive className="h-4 w-4 text-[var(--color-indigo-accent)]" /> Memory map
        </CardTitle>
      </CardHeader>
      <CardContent>
        {scan ? (
          <MemoryMeter used={scan.memoryUsed} total={scan.memoryTotal} segments={segments} />
        ) : (
          <p className="text-xs text-muted-foreground">Awaiting first tag dump.</p>
        )}
      </CardContent>
    </Card>
  );
}

function NdefCard({ scan }: { scan: TagScan | null }) {
  return (
    <Card className="panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Cpu className="h-4 w-4 text-[var(--color-indigo-accent)]" /> NDEF records
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!scan || scan.records.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {scan?.parseError ?? "No records parsed for this tag."}
          </p>
        ) : (
          scan.records.map((record, i) => (
            <div
              key={i}
              className="rounded-md border border-panel-border/70 bg-[var(--color-surface)]/60 p-2"
            >
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <Badge variant="outline" className="border-panel-border">
                  {record.kind}
                </Badge>
                <span className="mono">
                  TNF {record.tnf} · type {record.type || "—"} · {record.payload.length}B
                </span>
              </div>
              <p className="mt-1 break-words text-xs">
                {record.text || <span className="text-muted-foreground">(binary payload)</span>}
              </p>
              {record.children && record.children.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <ul className="space-y-1 pl-3 text-[11px] text-muted-foreground">
                    {record.children.map((child, j) => (
                      <li key={j}>
                        <span className="mono text-foreground">{child.kind}</span> · {child.text}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function HexDumpCard({ scan }: { scan: TagScan | null }) {
  const highlight = useMemo(() => {
    if (!scan || scan.records.length === 0) return null;
    const total = scan.records.reduce((sum, r) => sum + r.byteLength, 0);
    return { start: scan.ndefOffset, end: scan.ndefOffset + total };
  }, [scan]);

  return (
    <Card className="panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Cpu className="h-4 w-4 text-[var(--color-indigo-accent)]" /> Hex dump · ASCII viewer
          {scan && (
            <span className="mono ml-auto text-[11px] text-muted-foreground">
              {scan.raw.length} bytes
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <HexViewer bytes={scan?.raw ?? new Uint8Array(0)} highlight={highlight} />
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-panel-border/60 bg-[var(--color-surface)]/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm text-foreground", mono && "mono text-[13px]")}>{value}</p>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour12: false });
}
