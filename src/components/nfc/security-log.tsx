import { ShieldAlert, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStation } from "@/lib/nfc/station-store";

export function SecurityLog() {
  const events = useStation((s) => s.securityEvents);

  return (
    <Card className="panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldAlert className="h-4 w-4 text-[var(--color-signal-block)]" /> Edge Security · EMV
          intercept log
          <Badge className="ml-auto bg-[var(--color-signal-block)]/15 text-[var(--color-signal-block)]">
            {events.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[320px]">
          {events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-xs text-muted-foreground">
              <ShieldCheck className="h-5 w-5 text-[var(--color-signal-online)]" />
              No AID blocks yet. Mobile client will emit{" "}
              <span className="mono">mobile-aid-block</span> when it drops financial AIDs.
            </div>
          ) : (
            <ul className="divide-y divide-panel-border/60 text-xs">
              {events.map((event) => (
                <li key={event.id} className="flex items-start gap-3 px-3 py-2">
                  <span className="signal-dot mt-1.5 text-[var(--color-signal-block)]" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{event.scheme}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(event.at).toLocaleTimeString(undefined, { hour12: false })}
                      </span>
                    </div>
                    <p className="mono text-[11px] text-muted-foreground">AID {event.aid}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px]">
                      <Badge
                        variant="outline"
                        className="border-[var(--color-signal-block)]/40 text-[var(--color-signal-block)]"
                      >
                        {event.action}
                      </Badge>
                      {event.detail && (
                        <span className="text-muted-foreground">{event.detail}</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
