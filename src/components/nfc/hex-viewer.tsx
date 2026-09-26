import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface HexViewerProps {
  bytes: Uint8Array;
  bytesPerRow?: number;
  highlight?: { start: number; end: number } | null;
  emptyLabel?: string;
}

export function HexViewer({
  bytes,
  bytesPerRow = 16,
  highlight = null,
  emptyLabel = "No buffer yet",
}: HexViewerProps) {
  const rows = useMemo(() => {
    const out: Array<{ offset: number; slice: Uint8Array }> = [];
    for (let i = 0; i < bytes.length; i += bytesPerRow) {
      out.push({ offset: i, slice: bytes.slice(i, i + bytesPerRow) });
    }
    return out;
  }, [bytes, bytesPerRow]);

  if (bytes.length === 0) {
    return (
      <div className="mono flex h-full min-h-40 items-center justify-center rounded-md border border-dashed border-panel-border text-xs text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full max-h-[420px] rounded-md border border-panel-border bg-[var(--color-surface)]">
      <table className="mono w-full text-[11px] leading-relaxed">
        <thead className="sticky top-0 z-10 bg-[var(--color-surface)]/95 text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
          <tr>
            <th className="w-20 py-2 pl-3 text-left font-medium">Offset</th>
            <th className="text-left font-medium">Hex</th>
            <th className="w-40 pr-3 text-left font-medium">ASCII</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ offset, slice }) => (
            <tr key={offset} className="border-t border-panel-border/60 align-top">
              <td className="py-1 pl-3 text-muted-foreground">
                {offset.toString(16).padStart(6, "0").toUpperCase()}
              </td>
              <td className="whitespace-pre py-1">
                {Array.from(slice).map((byte, i) => {
                  const abs = offset + i;
                  const isHi =
                    highlight && abs >= highlight.start && abs < highlight.end;
                  return (
                    <span
                      key={i}
                      className={cn(
                        "inline-block w-[22px] text-center",
                        isHi && "rounded bg-[var(--color-indigo-accent)]/25 text-white",
                      )}
                    >
                      {byte.toString(16).padStart(2, "0").toUpperCase()}
                    </span>
                  );
                })}
              </td>
              <td className="whitespace-pre py-1 pr-3 text-muted-foreground">
                {Array.from(slice)
                  .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : "."))
                  .join("")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}
