export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type RfProtocol =
  | "ISO 14443-A"
  | "ISO 14443-B"
  | "ISO 15693"
  | "FeliCa"
  | "Unknown";

export interface NdefRecord {
  /** Type Name Format value (0-7) as defined by the NFC Forum NDEF spec. */
  tnf: number;
  tnfLabel: string;
  type: string;
  id: string | null;
  /** Human readable classification: Text, URI, Smart Poster, vCard, MIME, ... */
  kind: string;
  /** Decoded, human readable payload (best effort). */
  text: string;
  /** Raw payload bytes of this record. */
  payload: Uint8Array;
  /** Total on-tag size of the record including header bytes. */
  byteLength: number;
  /** Nested records, present for Smart Posters. */
  children?: NdefRecord[];
}

export interface TagScan {
  /** Monotonic id supplied by the mobile engine, or generated on arrival. */
  id: string;
  receivedAt: number;
  uid: number[];
  atqa?: string | null;
  sak?: string | null;
  protocol: RfProtocol;
  tagType?: string | null;
  manufacturer: string;
  writable: boolean;
  memoryTotal: number;
  memoryUsed: number;
  /** Full raw dump of the tag memory. */
  raw: Uint8Array;
  /** Byte offset inside `raw` where the NDEF message begins. */
  ndefOffset: number;
  records: NdefRecord[];
  parseError?: string | null;
}

export interface SecurityEvent {
  id: string;
  at: number;
  aid: string;
  scheme: string;
  action: "blocked" | "dropped" | "flagged";
  detail?: string | null;
}

export interface LogEntry {
  id: string;
  at: number;
  direction: "in" | "out" | "system";
  channel: string;
  detail: string;
}

export type PayloadKind = "text" | "uri" | "vcard" | "wifi" | "bluetooth";

export interface WriteOperation {
  id: string;
  kind: PayloadKind;
  label: string;
  bytes: Uint8Array;
  createdAt: number;
  state: "queued" | "sent" | "acked" | "failed";
  detail?: string | null;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  whenEvent: string;
  whenField: string;
  whenOperator: "equals" | "contains" | "startsWith" | "greaterThan";
  whenValue: string;
  thenAction: string;
  thenArgument: string;
  hits: number;
  lastFiredAt: number | null;
}
