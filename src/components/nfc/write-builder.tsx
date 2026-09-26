import { useState } from "react";
import { Flame, Radio, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { bytesToHex } from "@/lib/nfc/bytes";
import {
  bluetoothRecord,
  encodeNdefMessage,
  textRecord,
  uriRecord,
  vcardRecord,
  wifiRecord,
  wrapTlv,
} from "@/lib/nfc/ndef";
import { queueOperation, sendOperation, useStation } from "@/lib/nfc/station-store";
import type { PayloadKind } from "@/lib/nfc/types";

interface Draft {
  kind: PayloadKind;
  label: string;
  bytes: Uint8Array;
}

export function WriteBuilder() {
  const operations = useStation((s) => s.operations);
  const engineOnline = useStation((s) => s.mobileEngineOnline);
  const [draft, setDraft] = useState<Draft | null>(null);

  const burn = () => {
    if (!draft) return;
    const op = queueOperation(draft);
    const ok = sendOperation(op);
    if (ok) {
      toast.success(`Burned to phone`, {
        description: `${op.label} · ${op.bytes.length} bytes queued to mobile engine`,
      });
    } else {
      toast.error("Mobile engine offline", {
        description: "Pair the mobile engine before burning a payload.",
      });
    }
  };

  return (
    <Card className="panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Flame className="h-4 w-4 text-[var(--color-indigo-accent)]" /> Payload Write Builder
          <span className="ml-auto text-[11px] text-muted-foreground">
            {engineOnline ? "Engine ready" : "Engine offline — burn will queue"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <Tabs defaultValue="text" onValueChange={() => setDraft(null)}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="uri">URI</TabsTrigger>
              <TabsTrigger value="vcard">vCard</TabsTrigger>
              <TabsTrigger value="wifi">Wi-Fi</TabsTrigger>
              <TabsTrigger value="bt">Bluetooth</TabsTrigger>
            </TabsList>
            <TabsContent value="text"><TextForm onDraft={setDraft} /></TabsContent>
            <TabsContent value="uri"><UriForm onDraft={setDraft} /></TabsContent>
            <TabsContent value="vcard"><VcardForm onDraft={setDraft} /></TabsContent>
            <TabsContent value="wifi"><WifiForm onDraft={setDraft} /></TabsContent>
            <TabsContent value="bt"><BluetoothForm onDraft={setDraft} /></TabsContent>
          </Tabs>
          <div className="rounded-md border border-panel-border bg-[var(--color-surface)] p-3 text-[11px]">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Serialized NDEF (TLV wrapped)</span>
              <span className="mono">{draft?.bytes.length ?? 0} bytes</span>
            </div>
            <p className="mono mt-2 max-h-32 overflow-y-auto break-all text-[11px] text-foreground">
              {draft ? bytesToHex(draft.bytes, " ") : "Fill the form above to preview the byte stream."}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={!draft}>
              Clear
            </Button>
            <Button onClick={burn} disabled={!draft} className="gap-2">
              <Flame className="h-4 w-4" /> Burn Payload to Phone
            </Button>
          </div>
        </div>
        <OperationsLog operations={operations} />
      </CardContent>
    </Card>
  );
}

function makeDraft(kind: PayloadKind, label: string, encoded: Uint8Array): Draft {
  return { kind, label, bytes: wrapTlv(encoded) };
}

function TextForm({ onDraft }: { onDraft: (d: Draft | null) => void }) {
  const [value, setValue] = useState("Hello from NFC-DDS");
  const [lang, setLang] = useState("en");
  const build = () => {
    if (!value) return onDraft(null);
    onDraft(
      makeDraft("text", `Text · ${value.slice(0, 32)}`, encodeNdefMessage([textRecord(value, lang)])),
    );
  };
  return (
    <div className="mt-3 space-y-2 text-xs">
      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
        <Label>Lang</Label>
        <Input value={lang} onChange={(e) => setLang(e.target.value)} onBlur={build} className="mono h-8" />
      </div>
      <Label>Message</Label>
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} onBlur={build} rows={4} />
      <Button size="sm" variant="secondary" onClick={build}>Update draft</Button>
    </div>
  );
}

function UriForm({ onDraft }: { onDraft: (d: Draft | null) => void }) {
  const [value, setValue] = useState("https://nfc.example/dds");
  const build = () => {
    if (!value) return onDraft(null);
    onDraft(makeDraft("uri", `URI · ${value}`, encodeNdefMessage([uriRecord(value)])));
  };
  return (
    <div className="mt-3 space-y-2 text-xs">
      <Label>URI (http, https, tel:, mailto:, …)</Label>
      <Input value={value} onChange={(e) => setValue(e.target.value)} onBlur={build} className="mono" />
      <Button size="sm" variant="secondary" onClick={build}>Update draft</Button>
    </div>
  );
}

function VcardForm({ onDraft }: { onDraft: (d: Draft | null) => void }) {
  const [name, setName] = useState("Ada Lovelace");
  const [org, setOrg] = useState("NFC-DDS Labs");
  const [phone, setPhone] = useState("+1-555-0100");
  const [email, setEmail] = useState("ada@nfc-dds.dev");
  const build = () => {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${name}`,
      `ORG:${org}`,
      `TEL;TYPE=WORK:${phone}`,
      `EMAIL:${email}`,
      "END:VCARD",
    ].join("\n");
    onDraft(makeDraft("vcard", `vCard · ${name}`, encodeNdefMessage([vcardRecord(vcard)])));
  };
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
      <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} onBlur={build} /></div>
      <div><Label>Org</Label><Input value={org} onChange={(e) => setOrg(e.target.value)} onBlur={build} /></div>
      <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={build} className="mono" /></div>
      <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} onBlur={build} className="mono" /></div>
      <div className="col-span-2"><Button size="sm" variant="secondary" onClick={build}>Update draft</Button></div>
    </div>
  );
}

function WifiForm({ onDraft }: { onDraft: (d: Draft | null) => void }) {
  const [ssid, setSsid] = useState("NFC-DDS-Bench");
  const [pass, setPass] = useState("correct-horse-battery");
  const [auth, setAuth] = useState("wpa2");
  const build = () => {
    if (!ssid) return onDraft(null);
    const mode = auth === "wpa2" ? 0x0020 : auth === "wpa" ? 0x0022 : 0x0001;
    onDraft(
      makeDraft("wifi", `Wi-Fi · ${ssid}`, encodeNdefMessage([wifiRecord(ssid, pass, mode)])),
    );
  };
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
      <div className="col-span-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Wifi className="h-3.5 w-3.5" /> Encoded as WPS credential TLV block.
      </div>
      <div><Label>SSID</Label><Input value={ssid} onChange={(e) => setSsid(e.target.value)} onBlur={build} /></div>
      <div>
        <Label>Auth</Label>
        <Select value={auth} onValueChange={(v) => { setAuth(v); setTimeout(build, 0); }}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="wpa2">WPA2-PSK</SelectItem>
            <SelectItem value="wpa">WPA/WPA2</SelectItem>
            <SelectItem value="open">Open</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2"><Label>Passphrase</Label><Input value={pass} onChange={(e) => setPass(e.target.value)} onBlur={build} className="mono" /></div>
      <div className="col-span-2"><Button size="sm" variant="secondary" onClick={build}>Update draft</Button></div>
    </div>
  );
}

function BluetoothForm({ onDraft }: { onDraft: (d: Draft | null) => void }) {
  const [mac, setMac] = useState("AA:BB:CC:11:22:33");
  const [name, setName] = useState("DDS-Headset");
  const build = () => {
    if (!/^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$/i.test(mac)) return onDraft(null);
    onDraft(
      makeDraft("bluetooth", `Bluetooth · ${name}`, encodeNdefMessage([bluetoothRecord(mac, name)])),
    );
  };
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
      <div className="col-span-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Radio className="h-3.5 w-3.5" /> Encoded as Bluetooth OOB EIR record.
      </div>
      <div><Label>Device name</Label><Input value={name} onChange={(e) => setName(e.target.value)} onBlur={build} /></div>
      <div><Label>MAC address</Label><Input value={mac} onChange={(e) => setMac(e.target.value)} onBlur={build} className="mono" /></div>
      <div className="col-span-2"><Button size="sm" variant="secondary" onClick={build}>Update draft</Button></div>
    </div>
  );
}

function OperationsLog({ operations }: { operations: ReturnType<typeof useStation<any>> }) {
  return (
    <div className="rounded-md border border-panel-border bg-[var(--color-surface)]/60">
      <div className="flex items-center justify-between border-b border-panel-border/70 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Outbound queue
        </p>
        <span className="text-[11px] text-muted-foreground">
          {operations.length} operation{operations.length === 1 ? "" : "s"}
        </span>
      </div>
      <ScrollArea className="h-[420px]">
        {operations.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            No <span className="mono">desktop-operation-prepared</span> emits yet.
          </p>
        ) : (
          <ul className="divide-y divide-panel-border/60 text-xs">
            {operations.map((op: any) => (
              <li key={op.id} className="p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{op.label}</span>
                  <StateBadge state={op.state} />
                </div>
                <div className="mono mt-1 text-[11px] text-muted-foreground">
                  {op.kind} · {op.bytes.length} bytes · {new Date(op.createdAt).toLocaleTimeString()}
                </div>
                {op.detail && <p className="mt-1 text-[11px] text-muted-foreground">{op.detail}</p>}
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, string> = {
    queued: "bg-muted text-muted-foreground",
    sent: "bg-[var(--color-signal-warn)]/20 text-[var(--color-signal-warn)]",
    acked: "bg-[var(--color-signal-online)]/20 text-[var(--color-signal-online)]",
    failed: "bg-[var(--color-signal-block)]/20 text-[var(--color-signal-block)]",
  };
  return <Badge className={map[state] ?? ""}>{state}</Badge>;
}

// silence unused import warning helpers
export const __trash = Trash2;
