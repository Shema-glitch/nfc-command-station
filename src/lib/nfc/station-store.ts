import { io, type Socket } from "socket.io-client";
import { useSyncExternalStore } from "react";

import { manufacturerFromUid, protocolFromSak, schemeForAid } from "./chip";
import { findNdefOffset, parseNdefMessage } from "./ndef";
import { bytesToHex, toUint8 } from "./bytes";
import type {
  AutomationRule,
  ConnectionStatus,
  LogEntry,
  SecurityEvent,
  TagScan,
  WriteOperation,
} from "./types";

export interface StationState {
  status: ConnectionStatus;
  relayUrl: string;
  token: string;
  socketId: string | null;
  mobileEngineOnline: boolean;
  lastError: string | null;
  scans: TagScan[];
  activeScanId: string | null;
  securityEvents: SecurityEvent[];
  log: LogEntry[];
  operations: WriteOperation[];
  rules: AutomationRule[];
}

const LOG_LIMIT = 200;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function defaultRelayUrl(): string {
  if (typeof window === "undefined") return "";
  const env = import.meta.env["VITE_NFC_RELAY_URL"];
  if (typeof env === "string" && env) return env;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8443`;
}

let state: StationState = {
  status: "disconnected",
  relayUrl: "",
  token: "",
  socketId: null,
  mobileEngineOnline: false,
  lastError: null,
  scans: [],
  activeScanId: null,
  securityEvents: [],
  log: [],
  operations: [],
  rules: [],
};

const listeners = new Set<() => void>();
let socket: Socket | null = null;

function set(patch: Partial<StationState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function pushLog(entry: Omit<LogEntry, "id" | "at">) {
  set({ log: [{ id: randomId(), at: Date.now(), ...entry }, ...state.log].slice(0, LOG_LIMIT) });
}

export const stationStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): StationState {
    return state;
  },
};

export function useStation<T>(selector: (s: StationState) => T): T {
  return useSyncExternalStore(
    stationStore.subscribe,
    () => selector(state),
    () => selector(state),
  );
}

/* ------------------------------------------------------------------ */
/* Session + connection                                                */
/* ------------------------------------------------------------------ */

export function ensureSession() {
  if (state.token && state.relayUrl) return;
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined") crypto.getRandomValues(bytes);
  const token = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  set({ token: state.token || token, relayUrl: state.relayUrl || defaultRelayUrl() });
}

export function rotateSession() {
  set({ token: "" });
  ensureSession();
  pushLog({ direction: "system", channel: "session", detail: "Session token rotated" });
  if (socket) connect();
}

export function setRelayUrl(url: string) {
  set({ relayUrl: url });
}

export function pairingUrl(): string {
  if (!state.relayUrl || !state.token) return "";
  const separator = state.relayUrl.includes("?") ? "&" : "?";
  return `${state.relayUrl}${separator}token=${state.token}`;
}

export function connect() {
  ensureSession();
  disconnect();
  const target = state.relayUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
  set({ status: "connecting", lastError: null });
  pushLog({ direction: "system", channel: "socket", detail: `Dialling relay ${target}` });

  const client = io(target, {
    transports: ["websocket"],
    auth: { token: state.token, role: "desktop" },
    query: { token: state.token, role: "desktop" },
    reconnectionAttempts: 5,
    timeout: 8000,
  });
  socket = client;

  client.on("connect", () => {
    set({ status: "connected", socketId: client.id ?? null, lastError: null });
    pushLog({ direction: "system", channel: "socket", detail: `Connected as ${client.id}` });
    client.emit("desktop-register", { token: state.token });
  });

  client.on("disconnect", (reason) => {
    set({ status: "disconnected", socketId: null, mobileEngineOnline: false });
    pushLog({ direction: "system", channel: "socket", detail: `Disconnected: ${reason}` });
  });

  client.on("connect_error", (error: Error) => {
    set({ status: "error", lastError: error.message });
    pushLog({ direction: "system", channel: "socket", detail: `Connect error: ${error.message}` });
  });

  client.on("mobile-engine-connected", (payload: { device?: string } = {}) => {
    set({ mobileEngineOnline: true });
    pushLog({
      direction: "in",
      channel: "mobile-engine-connected",
      detail: payload.device ?? "Mobile engine online",
    });
  });

  client.on("mobile-engine-disconnected", () => {
    set({ mobileEngineOnline: false });
    pushLog({ direction: "in", channel: "mobile-engine-disconnected", detail: "Engine offline" });
  });

  client.on("mobile-scan-result", (payload: unknown) => ingestScan(payload));

  client.on("mobile-aid-block", (payload: unknown) => ingestAidBlock(payload));
  client.on("mobile-security-event", (payload: unknown) => ingestAidBlock(payload));

  client.on("mobile-operation-result", (payload: { id?: string; ok?: boolean; detail?: string }) => {
    const { id, ok, detail } = payload ?? {};
    set({
      operations: state.operations.map((op) =>
        op.id === id ? { ...op, state: ok ? "acked" : "failed", detail: detail ?? null } : op,
      ),
    });
    pushLog({
      direction: "in",
      channel: "mobile-operation-result",
      detail: `${id ?? "unknown"} → ${ok ? "acked" : "failed"}${detail ? ` (${detail})` : ""}`,
    });
  });
}

export function disconnect() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  set({ status: "disconnected", socketId: null, mobileEngineOnline: false });
}

/* ------------------------------------------------------------------ */
/* Inbound payload handling                                            */
/* ------------------------------------------------------------------ */

interface RawScanPayload {
  id?: string;
  uid?: number[] | string;
  atqa?: string;
  sak?: string;
  protocol?: string;
  tagType?: string;
  writable?: boolean;
  memoryTotal?: number;
  memorySize?: number;
  memoryUsed?: number;
  data?: unknown;
  raw?: unknown;
  buffer?: unknown;
}

/** Normalise a raw `mobile-scan-result` frame into a parsed TagScan. */
export function ingestScan(payload: unknown): TagScan | null {
  if (!payload || typeof payload !== "object") return null;
  const frame = payload as RawScanPayload;
  const raw = toUint8(frame.data ?? frame.raw ?? frame.buffer ?? []);
  const uid = Array.from(toUint8(frame.uid ?? []));

  let records: TagScan["records"] = [];
  let ndefOffset = 0;
  let parseError: string | null = null;
  try {
    const located = findNdefOffset(raw);
    if (located) {
      ndefOffset = located.offset;
      records = parseNdefMessage(raw.slice(located.offset, located.offset + located.length));
    } else if (raw.length > 0) {
      parseError = "No NDEF TLV found in dump";
    }
  } catch (error) {
    parseError = error instanceof Error ? error.message : "NDEF parse failed";
  }

  const memoryTotal = frame.memoryTotal ?? frame.memorySize ?? raw.length;
  const memoryUsed =
    frame.memoryUsed ?? records.reduce((sum, record) => sum + record.byteLength, 0);

  const scan: TagScan = {
    id: frame.id ?? randomId(),
    receivedAt: Date.now(),
    uid,
    atqa: frame.atqa ?? null,
    sak: frame.sak ?? null,
    protocol: protocolFromSak(frame.sak, frame.protocol),
    tagType: frame.tagType ?? null,
    manufacturer: manufacturerFromUid(uid),
    writable: frame.writable ?? false,
    memoryTotal,
    memoryUsed: Math.min(memoryUsed, memoryTotal),
    raw,
    ndefOffset,
    records,
    parseError,
  };

  set({ scans: [scan, ...state.scans].slice(0, 25), activeScanId: scan.id });
  pushLog({
    direction: "in",
    channel: "mobile-scan-result",
    detail: `UID ${bytesToHex(uid, ":") || "—"} · ${raw.length} bytes · ${records.length} record(s)`,
  });
  evaluateRules(scan);
  return scan;
}

export function ingestAidBlock(payload: unknown): SecurityEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const frame = payload as { aid?: string; scheme?: string; action?: string; detail?: string };
  const aid = (frame.aid ?? "").toUpperCase();
  if (!aid) return null;
  const event: SecurityEvent = {
    id: randomId(),
    at: Date.now(),
    aid,
    scheme: frame.scheme ?? schemeForAid(aid),
    action: (frame.action as SecurityEvent["action"]) ?? "blocked",
    detail: frame.detail ?? null,
  };
  set({ securityEvents: [event, ...state.securityEvents].slice(0, 100) });
  pushLog({
    direction: "in",
    channel: "mobile-aid-block",
    detail: `${event.scheme} (${aid}) ${event.action} at hardware layer`,
  });
  return event;
}

export function selectScan(id: string) {
  set({ activeScanId: id });
}

export function activeScan(s: StationState = state): TagScan | null {
  return s.scans.find((scan) => scan.id === s.activeScanId) ?? s.scans[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Outbound operations                                                 */
/* ------------------------------------------------------------------ */

export function queueOperation(op: Omit<WriteOperation, "id" | "createdAt" | "state">) {
  const operation: WriteOperation = {
    ...op,
    id: randomId(),
    createdAt: Date.now(),
    state: "queued",
  };
  set({ operations: [operation, ...state.operations].slice(0, 50) });
  return operation;
}

export function sendOperation(operation: WriteOperation): boolean {
  if (!socket || state.status !== "connected") {
    set({
      operations: state.operations.map((op) =>
        op.id === operation.id ? { ...op, state: "failed", detail: "No mobile engine link" } : op,
      ),
    });
    pushLog({
      direction: "out",
      channel: "desktop-operation-prepared",
      detail: "Rejected — socket link is down",
    });
    return false;
  }
  socket.emit("desktop-operation-prepared", {
    id: operation.id,
    kind: operation.kind,
    label: operation.label,
    // Plain array survives JSON serialisation across the relay.
    bytes: Array.from(operation.bytes),
    hex: bytesToHex(operation.bytes, ""),
    issuedAt: operation.createdAt,
  });
  set({
    operations: state.operations.map((op) =>
      op.id === operation.id ? { ...op, state: "sent" } : op,
    ),
  });
  pushLog({
    direction: "out",
    channel: "desktop-operation-prepared",
    detail: `${operation.label} · ${operation.bytes.length} bytes`,
  });
  return true;
}

export function emitCommand(channel: string, payload: Record<string, unknown>) {
  if (!socket || state.status !== "connected") return false;
  socket.emit(channel, payload);
  pushLog({ direction: "out", channel, detail: JSON.stringify(payload).slice(0, 120) });
  return true;
}

/* ------------------------------------------------------------------ */
/* Automation rules                                                    */
/* ------------------------------------------------------------------ */

export function upsertRule(rule: AutomationRule) {
  const exists = state.rules.some((r) => r.id === rule.id);
  set({
    rules: exists ? state.rules.map((r) => (r.id === rule.id ? rule : r)) : [...state.rules, rule],
  });
}

export function createRule(partial: Partial<AutomationRule>): AutomationRule {
  return {
    id: randomId(),
    name: partial.name ?? "Untitled profile",
    enabled: partial.enabled ?? true,
    whenEvent: partial.whenEvent ?? "mobile-scan-result",
    whenField: partial.whenField ?? "manufacturer",
    whenOperator: partial.whenOperator ?? "equals",
    whenValue: partial.whenValue ?? "",
    thenAction: partial.thenAction ?? "desktop-operation-prepared",
    thenArgument: partial.thenArgument ?? "",
    hits: 0,
    lastFiredAt: null,
  };
}

export function removeRule(id: string) {
  set({ rules: state.rules.filter((r) => r.id !== id) });
}

function fieldValue(scan: TagScan, field: string): string {
  switch (field) {
    case "manufacturer":
      return scan.manufacturer;
    case "uid":
      return bytesToHex(scan.uid, "");
    case "protocol":
      return scan.protocol;
    case "recordKind":
      return scan.records.map((r) => r.kind).join(",");
    case "recordText":
      return scan.records.map((r) => r.text).join(" ");
    case "memoryUsed":
      return String(scan.memoryUsed);
    default:
      return "";
  }
}

function evaluateRules(scan: TagScan) {
  const fired: AutomationRule[] = [];
  const next = state.rules.map((rule) => {
    if (!rule.enabled || rule.whenEvent !== "mobile-scan-result") return rule;
    const value = fieldValue(scan, rule.whenField).toLowerCase();
    const target = rule.whenValue.trim().toLowerCase();
    if (!target) return rule;
    const matched =
      rule.whenOperator === "equals"
        ? value === target
        : rule.whenOperator === "contains"
          ? value.includes(target)
          : rule.whenOperator === "startsWith"
            ? value.startsWith(target)
            : Number(value) > Number(target);
    if (!matched) return rule;
    const updated = { ...rule, hits: rule.hits + 1, lastFiredAt: Date.now() };
    fired.push(updated);
    return updated;
  });
  if (fired.length === 0) return;
  set({ rules: next });
  for (const rule of fired) {
    emitCommand(rule.thenAction, {
      source: "automation",
      rule: rule.name,
      argument: rule.thenArgument,
      scanId: scan.id,
    });
    pushLog({ direction: "system", channel: "automation", detail: `Rule "${rule.name}" fired` });
  }
}
