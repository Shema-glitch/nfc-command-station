import { useState } from "react";
import { Plus, Trash2, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createRule, removeRule, upsertRule, useStation } from "@/lib/nfc/station-store";
import type { AutomationRule } from "@/lib/nfc/types";

const FIELDS = ["manufacturer", "uid", "protocol", "recordKind", "recordText", "memoryUsed"];
const OPS: AutomationRule["whenOperator"][] = ["equals", "contains", "startsWith", "greaterThan"];
const ACTIONS = [
  "desktop-operation-prepared",
  "desktop-lock-tag",
  "desktop-highlight",
  "desktop-notify",
];

export function AutomationGrid() {
  const rules = useStation((s) => s.rules);
  const [draft, setDraft] = useState<AutomationRule>(createRule({}));

  return (
    <Card className="panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Workflow className="h-4 w-4 text-[var(--color-indigo-accent)]" /> Automation Task Engine
          <span className="ml-auto text-[11px] text-muted-foreground">
            {rules.length} profile{rules.length === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 rounded-md border border-panel-border bg-[var(--color-surface)]/60 p-3 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))_1.4fr_1.2fr_auto]">
          <Input
            placeholder="Profile name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Select value={draft.whenField} onValueChange={(v) => setDraft({ ...draft, whenField: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIELDS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={draft.whenOperator}
            onValueChange={(v) => setDraft({ ...draft, whenOperator: v as AutomationRule["whenOperator"] })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OPS.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="value"
            value={draft.whenValue}
            className="mono"
            onChange={(e) => setDraft({ ...draft, whenValue: e.target.value })}
          />
          <Select value={draft.thenAction} onValueChange={(v) => setDraft({ ...draft, thenAction: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="argument"
            value={draft.thenArgument}
            className="mono"
            onChange={(e) => setDraft({ ...draft, thenArgument: e.target.value })}
          />
          <Button
            size="sm"
            className="gap-1"
            onClick={() => {
              upsertRule(draft);
              setDraft(createRule({}));
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Save
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border border-panel-border">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-surface)]/70 text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Enabled</th>
                <th className="px-3 py-2 text-left">Profile</th>
                <th className="px-3 py-2 text-left">IF</th>
                <th className="px-3 py-2 text-left">THEN</th>
                <th className="px-3 py-2 text-left">Hits</th>
                <th className="px-3 py-2 text-left">Last fired</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    No macros yet. Compose one above.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="border-t border-panel-border/60">
                    <td className="px-3 py-2">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(v) => upsertRule({ ...rule, enabled: v })}
                      />
                    </td>
                    <td className="px-3 py-2 text-foreground">{rule.name}</td>
                    <td className="mono px-3 py-2 text-muted-foreground">
                      {rule.whenField} {rule.whenOperator} <span className="text-foreground">{rule.whenValue || "—"}</span>
                    </td>
                    <td className="mono px-3 py-2 text-muted-foreground">
                      emit <span className="text-foreground">{rule.thenAction}</span>
                      {rule.thenArgument && ` · ${rule.thenArgument}`}
                    </td>
                    <td className="px-3 py-2"><Badge variant="secondary">{rule.hits}</Badge></td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {rule.lastFiredAt ? new Date(rule.lastFiredAt).toLocaleTimeString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => removeRule(rule.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
