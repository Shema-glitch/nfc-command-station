import { cn } from "@/lib/utils";

interface MemoryMeterProps {
  used: number;
  total: number;
  segments?: Array<{ start: number; end: number; label: string }>;
}

export function MemoryMeter({ used, total, segments = [] }: MemoryMeterProps) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.round((used / safeTotal) * 100));

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <div>
          <span className="mono text-lg font-semibold text-foreground">{used}</span>
          <span className="ml-1">bytes used</span>
        </div>
        <div>
          <span className="mono text-foreground">{safeTotal - used}</span>
          <span className="ml-1">free of {safeTotal}</span>
        </div>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full border border-panel-border bg-[var(--color-surface)]">
        <div
          className="h-full bg-[linear-gradient(90deg,var(--color-primary),var(--color-indigo-accent))]"
          style={{ width: `${percent}%` }}
        />
      </div>
      {segments.length > 0 && (
        <div className="grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
          {segments.map((seg, i) => {
            const size = Math.max(0, seg.end - seg.start);
            const pct = Math.round((size / safeTotal) * 100);
            return (
              <div
                key={i}
                className={cn(
                  "mono flex items-center justify-between rounded-md border border-panel-border/70 bg-[var(--color-surface)]/60 px-2 py-1",
                )}
              >
                <span className="truncate text-muted-foreground">{seg.label}</span>
                <span className="text-foreground">
                  {size}B · {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
