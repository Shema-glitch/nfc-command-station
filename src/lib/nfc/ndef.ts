import {
  bytesToAscii,
  bytesToUtf8,
  concatBytes,
  utf8ToBytes,
} from "./bytes";
import type { NdefRecord } from "./types";

const TNF_LABELS = [
  "Empty",
  "NFC Forum Well Known",
  "MIME Media",
  "Absolute URI",
  "NFC Forum External",
  "Unknown",
  "Unchanged",
  "Reserved",
];

export const URI_PREFIXES = [
  "",
  "http://www.",
  "https://www.",
  "http://",
  "https://",
  "tel:",
  "mailto:",
  "ftp://anonymous:anonymous@",
  "ftp://ftp.",
  "ftps://",
  "sftp://",
  "smb://",
  "nfs://",
  "ftp://",
  "dav://",
  "news:",
  "telnet://",
  "imap:",
  "rtsp://",
  "urn:",
  "pop:",
  "sip:",
  "sips:",
  "tftp:",
  "btspp://",
  "btl2cap://",
  "btgoep://",
  "tcpobex://",
  "irdaobex://",
  "file://",
  "urn:epc:id:",
  "urn:epc:tag:",
  "urn:epc:pat:",
  "urn:epc:raw:",
  "urn:epc:",
  "urn:nfc:",
];

/**
 * Locate the start of an NDEF message inside a raw tag dump.
 * Type 2 tags store NDEF inside a TLV block (0x03 len ...) that usually begins
 * at byte 16, right after the UID / lock / capability-container pages.
 */
export function findNdefOffset(raw: Uint8Array): { offset: number; length: number } | null {
  for (let i = 0; i < Math.min(raw.length, 64); i++) {
    if (raw[i] !== 0x03) continue;
    const lenByte = raw[i + 1];
    if (lenByte === undefined) continue;
    if (lenByte === 0xff) {
      const len = ((raw[i + 2] ?? 0) << 8) | (raw[i + 3] ?? 0);
      if (len > 0 && i + 4 + len <= raw.length) return { offset: i + 4, length: len };
      continue;
    }
    if (lenByte > 0 && i + 2 + lenByte <= raw.length) {
      // Sanity check: the first record header must have a valid TNF.
      const header = raw[i + 2] ?? 0;
      if ((header & 0x07) <= 0x06) return { offset: i + 2, length: lenByte };
    }
  }
  // Fall back to treating the buffer itself as a bare NDEF message.
  if (raw.length > 3 && (raw[0]! & 0x07) <= 0x06 && (raw[0]! & 0x80) !== 0) {
    return { offset: 0, length: raw.length };
  }
  return null;
}

export function parseNdefMessage(message: Uint8Array): NdefRecord[] {
  const records: NdefRecord[] = [];
  let i = 0;
  let guard = 0;
  while (i < message.length && guard++ < 64) {
    const start = i;
    const header = message[i++];
    if (header === undefined) break;
    const tnf = header & 0x07;
    const isShort = (header & 0x10) !== 0;
    const hasId = (header & 0x08) !== 0;
    const isEnd = (header & 0x40) !== 0;

    const typeLength = message[i++] ?? 0;
    let payloadLength: number;
    if (isShort) {
      payloadLength = message[i++] ?? 0;
    } else {
      payloadLength =
        ((message[i] ?? 0) << 24) |
        ((message[i + 1] ?? 0) << 16) |
        ((message[i + 2] ?? 0) << 8) |
        (message[i + 3] ?? 0);
      i += 4;
    }
    const idLength = hasId ? (message[i++] ?? 0) : 0;
    const type = bytesToAscii(message.slice(i, i + typeLength), "?");
    i += typeLength;
    const id = idLength ? bytesToAscii(message.slice(i, i + idLength), "?") : null;
    i += idLength;
    const payload = message.slice(i, i + payloadLength);
    i += payloadLength;

    records.push(decodeRecord(tnf, type, id, payload, i - start));
    if (isEnd) break;
    if (payloadLength === 0 && typeLength === 0) break;
  }
  return records;
}

function decodeRecord(
  tnf: number,
  type: string,
  id: string | null,
  payload: Uint8Array,
  byteLength: number,
): NdefRecord {
  const base: NdefRecord = {
    tnf,
    tnfLabel: TNF_LABELS[tnf] ?? "Reserved",
    type,
    id,
    kind: "Unknown",
    text: "",
    payload,
    byteLength,
  };

  if (tnf === 1 && type === "T") {
    const status = payload[0] ?? 0;
    const langLength = status & 0x3f;
    const lang = bytesToAscii(payload.slice(1, 1 + langLength), "?");
    const body = bytesToUtf8(payload.slice(1 + langLength));
    return { ...base, kind: "Text", text: `[${lang}] ${body}` };
  }

  if (tnf === 1 && type === "U") {
    const prefix = URI_PREFIXES[payload[0] ?? 0] ?? "";
    return { ...base, kind: "URI", text: prefix + bytesToUtf8(payload.slice(1)) };
  }

  if (tnf === 1 && type === "Sp") {
    const children = parseNdefMessage(payload);
    const title = children.find((c) => c.kind === "Text")?.text ?? "";
    const uri = children.find((c) => c.kind === "URI")?.text ?? "";
    return { ...base, kind: "Smart Poster", text: `${uri} ${title}`.trim(), children };
  }

  if (tnf === 2 && /vcard/i.test(type)) {
    return { ...base, kind: "vCard", text: bytesToUtf8(payload) };
  }

  if (tnf === 2 && /wfa\.wsc/i.test(type)) {
    return { ...base, kind: "Wi-Fi Config", text: decodeWifi(payload) };
  }

  if (tnf === 2 && /bluetooth/i.test(type)) {
    const mac = Array.from(payload.slice(2, 8))
      .reverse()
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join(":");
    return { ...base, kind: "Bluetooth OOB", text: mac };
  }

  if (tnf === 2) return { ...base, kind: `MIME (${type})`, text: bytesToUtf8(payload) };
  if (tnf === 3) return { ...base, kind: "Absolute URI", text: bytesToUtf8(payload) };
  if (tnf === 4) return { ...base, kind: `External (${type})`, text: bytesToUtf8(payload) };

  return { ...base, text: bytesToAscii(payload) };
}

function decodeWifi(payload: Uint8Array): string {
  // WSC credential TLVs are big-endian type(2) length(2) value(n).
  let ssid = "";
  let auth = "";
  let i = 0;
  while (i + 4 <= payload.length) {
    const type = ((payload[i] ?? 0) << 8) | (payload[i + 1] ?? 0);
    const len = ((payload[i + 2] ?? 0) << 8) | (payload[i + 3] ?? 0);
    const value = payload.slice(i + 4, i + 4 + len);
    if (type === 0x1045) ssid = bytesToUtf8(value);
    if (type === 0x1003) {
      const mode = ((value[0] ?? 0) << 8) | (value[1] ?? 0);
      auth = mode === 0x0020 ? "WPA2-PSK" : mode === 0x0022 ? "WPA/WPA2" : `0x${mode.toString(16)}`;
    }
    if (type === 0x100e) {
      const nested = decodeWifi(value);
      if (nested) return nested;
    }
    i += 4 + len;
  }
  return ssid ? `SSID ${ssid}${auth ? ` (${auth})` : ""}` : "Wi-Fi credential";
}

/* ------------------------------------------------------------------ */
/* Encoding                                                            */
/* ------------------------------------------------------------------ */

interface RawRecord {
  tnf: number;
  type: Uint8Array;
  payload: Uint8Array;
}

export function encodeNdefMessage(records: RawRecord[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  records.forEach((record, index) => {
    const short = record.payload.length < 256;
    let header = record.tnf;
    if (index === 0) header |= 0x80; // MB
    if (index === records.length - 1) header |= 0x40; // ME
    if (short) header |= 0x10; // SR

    const head = short
      ? Uint8Array.from([header, record.type.length, record.payload.length])
      : Uint8Array.from([
          header,
          record.type.length,
          (record.payload.length >>> 24) & 0xff,
          (record.payload.length >>> 16) & 0xff,
          (record.payload.length >>> 8) & 0xff,
          record.payload.length & 0xff,
        ]);
    chunks.push(head, record.type, record.payload);
  });
  return concatBytes(chunks);
}

export function textRecord(value: string, lang = "en"): RawRecord {
  const langBytes = utf8ToBytes(lang);
  return {
    tnf: 1,
    type: utf8ToBytes("T"),
    payload: concatBytes([
      Uint8Array.from([langBytes.length & 0x3f]),
      langBytes,
      utf8ToBytes(value),
    ]),
  };
}

export function uriRecord(value: string): RawRecord {
  let bestIndex = 0;
  let bestLength = 0;
  URI_PREFIXES.forEach((prefix, index) => {
    if (index === 0 || !prefix) return;
    if (value.startsWith(prefix) && prefix.length > bestLength) {
      bestIndex = index;
      bestLength = prefix.length;
    }
  });
  return {
    tnf: 1,
    type: utf8ToBytes("U"),
    payload: concatBytes([Uint8Array.from([bestIndex]), utf8ToBytes(value.slice(bestLength))]),
  };
}

export function vcardRecord(vcard: string): RawRecord {
  return { tnf: 2, type: utf8ToBytes("text/vcard"), payload: utf8ToBytes(vcard) };
}

function wscTlv(type: number, value: Uint8Array): Uint8Array {
  return concatBytes([
    Uint8Array.from([(type >> 8) & 0xff, type & 0xff, (value.length >> 8) & 0xff, value.length & 0xff]),
    value,
  ]);
}

export function wifiRecord(ssid: string, passphrase: string, authMode = 0x0020): RawRecord {
  const credential = concatBytes([
    wscTlv(0x1045, utf8ToBytes(ssid)),
    wscTlv(0x1003, Uint8Array.from([(authMode >> 8) & 0xff, authMode & 0xff])),
    wscTlv(0x100f, Uint8Array.from([0x00, 0x08])), // AES encryption type
    wscTlv(0x1027, utf8ToBytes(passphrase)),
  ]);
  return {
    tnf: 2,
    type: utf8ToBytes("application/vnd.wfa.wsc"),
    payload: wscTlv(0x100e, credential),
  };
}

export function bluetoothRecord(mac: string, name: string): RawRecord {
  const macBytes = Uint8Array.from(
    mac
      .split(/[:\-\s]/)
      .filter(Boolean)
      .map((part) => parseInt(part, 16) & 0xff)
      .reverse(),
  );
  const nameBytes = utf8ToBytes(name);
  const eir = concatBytes([Uint8Array.from([nameBytes.length + 1, 0x09]), nameBytes]);
  const total = 2 + macBytes.length + eir.length;
  return {
    tnf: 2,
    type: utf8ToBytes("application/vnd.bluetooth.ep.oob"),
    payload: concatBytes([Uint8Array.from([total & 0xff, (total >> 8) & 0xff]), macBytes, eir]),
  };
}

/** Wrap an NDEF message in a Type-2 TLV block, as written to tag memory. */
export function wrapTlv(message: Uint8Array): Uint8Array {
  const header =
    message.length < 0xff
      ? Uint8Array.from([0x03, message.length])
      : Uint8Array.from([0x03, 0xff, (message.length >> 8) & 0xff, message.length & 0xff]);
  return concatBytes([header, message, Uint8Array.from([0xfe])]);
}
