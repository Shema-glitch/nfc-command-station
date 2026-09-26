export function toUint8(input: unknown): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    const view = input as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (Array.isArray(input)) return Uint8Array.from(input.map((n) => Number(n) & 0xff));
  if (typeof input === "string") return hexToBytes(input);
  return new Uint8Array(0);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/0x/gi, "").replace(/[^0-9a-f]/gi, "");
  const even = clean.length % 2 === 0 ? clean : `0${clean}`;
  const out = new Uint8Array(even.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(even.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes: ArrayLike<number>, separator = " "): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    parts.push((bytes[i]! & 0xff).toString(16).padStart(2, "0").toUpperCase());
  }
  return parts.join(separator);
}

export function bytesToAscii(bytes: ArrayLike<number>, placeholder = "."): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]! & 0xff;
    out += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : placeholder;
  }
  return out;
}

export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Shannon entropy in bits per byte (0 - 8). */
export function shannonEntropy(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const counts = new Uint32Array(256);
  for (let i = 0; i < bytes.length; i++) counts[bytes[i]!]! += 1;
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    const c = counts[i]!;
    if (c === 0) continue;
    const p = c / bytes.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}
