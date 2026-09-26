import { Terminal } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStation } from "@/lib/nfc/station-store";
import { cn } from "@/lib/utils";

export function SocketLog() {
  const log = useStation((s) => s.log);
  return (
    <Card className="panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Terminal className="h-4 w-4 text-[var(--color-indigo-accent)]" /> Live socket log
          <span className="ml-auto text-[11px] text-muted-foreground">{log.length} events</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[320px]">
          <ul className="mono divide-y divide-panel-border/50 text-[11px]">
            {log.length === 0 ? (
              <li className="px-3 py-4 text-center text-muted-foreground">
                No socket traffic yet.
              </li>
            ) : (
              log.map((entry) => (
                <li key={entry.id} className="flex items-start gap-2 px-3 py-1.5">
                  <span className="text-muted-foreground">
                    {new Date(entry.at).toLocaleTimeString(undefined, { hour12: false })}
                  </span>
                  <span
                    className={cn(
                      "min-w-[46px] text-center text-[10px] uppercase",
                      entry.direction === "in"
                        ? "text-[var(--color-signal-online)]"
                        : entry.direction === "out"
                          ? "text-[var(--color-indigo-accent)]"
                          : "text-[var(--color-signal-warn)]",
                    )}
                  >
                    {entry.direction === "in" ? "◂ in" : entry.direction === "out" ? "out ▸" : "sys"}
                  </span>
                  <span className="text-foreground">{entry.channel}</span>
                  <span className="text-muted-foreground">{entry.detail}</span>
                </li>
              ))
            )}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
