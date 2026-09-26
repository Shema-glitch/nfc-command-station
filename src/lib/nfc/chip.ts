import type { RfProtocol } from "./types";

/** ISO/IEC 7816-6 manufacturer identifiers, keyed on UID byte 0. */
const MANUFACTURERS: Record<number, string> = {
  0x02: "STMicroelectronics",
  0x04: "NXP Semiconductors",
  0x05: "Infineon Technologies",
  0x07: "Texas Instruments",
  0x16: "EM Microelectronic",
  0x1d: "Broadcom",
  0x28: "Sony (FeliCa)",
  0x2b: "Renesas",
  0x34: "Shanghai Fudan",
  0x44: "Panasonic",
};

export function manufacturerFromUid(uid: number[]): string {
  const first = uid[0];
  if (first === undefined) return "Unknown";
  return MANUFACTURERS[first] ?? `Unregistered (0x${first.toString(16).padStart(2, "0")})`;
}

export function protocolFromSak(sak: string | null | undefined, fallback?: string): RfProtocol {
  if (fallback && /14443-?b/i.test(fallback)) return "ISO 14443-B";
  if (fallback && /15693/i.test(fallback)) return "ISO 15693";
  if (fallback && /felica/i.test(fallback)) return "FeliCa";
  if (fallback && /14443/i.test(fallback)) return "ISO 14443-A";
  return sak ? "ISO 14443-A" : "Unknown";
}

/** Known EMV Application Identifiers used to classify intercepted payloads. */
export const EMV_AIDS: Array<{ prefix: string; scheme: string }> = [
  { prefix: "A0000000031010", scheme: "Visa Credit/Debit" },
  { prefix: "A0000000032010", scheme: "Visa Electron" },
  { prefix: "A0000000033010", scheme: "Visa Interlink" },
  { prefix: "A0000000041010", scheme: "Mastercard Credit/Debit" },
  { prefix: "A0000000043060", scheme: "Maestro" },
  { prefix: "A000000025", scheme: "American Express" },
  { prefix: "A0000001523010", scheme: "Discover" },
  { prefix: "A0000000651010", scheme: "JCB" },
  { prefix: "A0000003330101", scheme: "UnionPay" },
];

export function schemeForAid(aid: string): string {
  const normalized = aid.replace(/[^0-9a-f]/gi, "").toUpperCase();
  const match = EMV_AIDS.find((entry) => normalized.startsWith(entry.prefix));
  return match ? match.scheme : "Unclassified financial AID";
}
