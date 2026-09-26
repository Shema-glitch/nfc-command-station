/// <reference lib="webworker" />
import CryptoJS from "crypto-js";

export type CryptoJob =
  | { type: "entropy"; jobId: string; bytes: number[] }
  | {
      type: "brute";
      jobId: string;
      cipher: "AES-128" | "AES-256" | "3DES";
      ciphertextBase64: string;
      passphrases: string[];
      knownPlaintext?: string;
    }
  | {
      type: "decrypt";
      jobId: string;
      cipher: "AES-128" | "AES-256" | "3DES";
      ciphertextBase64: string;
      passphrase: string;
    };

export type CryptoResult =
  | { type: "entropy"; jobId: string; entropy: number; classification: string; length: number }
  | {
      type: "brute-progress";
      jobId: string;
      tried: number;
      total: number;
      current: string;
    }
  | {
      type: "brute-result";
      jobId: string;
      matched: string | null;
      preview: string | null;
      tried: number;
    }
  | {
      type: "decrypt";
      jobId: string;
      ok: boolean;
      preview: string;
      hex: string;
    }
  | { type: "error"; jobId: string; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: CryptoResult) {
  ctx.postMessage(msg);
}

function shannon(bytes: number[]): number {
  if (bytes.length === 0) return 0;
  const counts = new Uint32Array(256);
  for (let i = 0; i < bytes.length; i++) counts[bytes[i]! & 0xff]!++;
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    const c = counts[i]!;
    if (c === 0) continue;
    const p = c / bytes.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function classify(entropy: number): string {
  if (entropy > 7.4) return "Encrypted / compressed";
  if (entropy > 6.5) return "High-entropy binary";
  if (entropy > 4.0) return "Structured binary";
  return "Low-entropy / plaintext";
}

function attemptDecrypt(cipher: string, ciphertextBase64: string, passphrase: string) {
  const key = deriveKey(cipher, passphrase);
  const ciphertext = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(ciphertextBase64),
  });
  const algo = cipher === "3DES" ? CryptoJS.TripleDES : CryptoJS.AES;
  const decrypted = algo.decrypt(ciphertext, key, {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
    iv: CryptoJS.enc.Hex.parse("00000000000000000000000000000000"),
  });
  const hex = decrypted.toString(CryptoJS.enc.Hex);
  let text = "";
  try {
    text = decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    text = "";
  }
  return { hex, text };
}

function deriveKey(cipher: string, passphrase: string) {
  const size = cipher === "AES-256" ? 8 : cipher === "3DES" ? 6 : 4; // words (32-bit)
  return CryptoJS.PBKDF2(passphrase, CryptoJS.enc.Utf8.parse("nfc-dds-salt"), {
    keySize: size,
    iterations: 1000,
  });
}

function looksLikeText(candidate: string, knownPlaintext?: string): boolean {
  if (!candidate) return false;
  if (knownPlaintext && candidate.includes(knownPlaintext)) return true;
  const printable = candidate.replace(/[^\x20-\x7e\r\n\t]/g, "");
  return printable.length >= candidate.length * 0.9 && candidate.length >= 4;
}

ctx.addEventListener("message", (event: MessageEvent<CryptoJob>) => {
  const job = event.data;
  try {
    if (job.type === "entropy") {
      const entropy = shannon(job.bytes);
      post({
        type: "entropy",
        jobId: job.jobId,
        entropy,
        classification: classify(entropy),
        length: job.bytes.length,
      });
      return;
    }
    if (job.type === "decrypt") {
      const { hex, text } = attemptDecrypt(job.cipher, job.ciphertextBase64, job.passphrase);
      post({
        type: "decrypt",
        jobId: job.jobId,
        ok: hex.length > 0,
        preview: text || "(binary output)",
        hex,
      });
      return;
    }
    if (job.type === "brute") {
      const total = job.passphrases.length;
      let matched: string | null = null;
      let preview: string | null = null;
      for (let i = 0; i < total; i++) {
        const passphrase = job.passphrases[i]!;
        const { text } = attemptDecrypt(job.cipher, job.ciphertextBase64, passphrase);
        if (looksLikeText(text, job.knownPlaintext)) {
          matched = passphrase;
          preview = text;
          break;
        }
        if (i % 5 === 0 || i === total - 1) {
          post({
            type: "brute-progress",
            jobId: job.jobId,
            tried: i + 1,
            total,
            current: passphrase,
          });
        }
      }
      post({
        type: "brute-result",
        jobId: job.jobId,
        matched,
        preview,
        tried: total,
      });
    }
  } catch (error) {
    post({
      type: "error",
      jobId: job.jobId,
      message: error instanceof Error ? error.message : "worker failure",
    });
  }
});
