import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { env } from "@/lib/env";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard
const AUTH_TAG_BYTES = 16;
const VERSION = 1;

let cachedKey: Buffer | null = null;

/**
 * Resolve the 32-byte master key from PF_ENCRYPTION_KEY (base64). Cached
 * on first read so decrypt hot-paths don't re-parse the env var per call.
 *
 * Rotating this key invalidates every existing ciphertext — treat it as a
 * one-time provisioned value. The README flags that explicitly at setup
 * time.
 */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const b64 = env.PF_ENCRYPTION_KEY;
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `PF_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}). Generate with: openssl rand -base64 32`,
    );
  }
  cachedKey = buf;
  return buf;
}

/**
 * Encrypt a plaintext string. Output layout:
 *
 *   <1-byte version><12-byte IV><16-byte auth tag><ciphertext...>
 *
 * All concatenated then base64-encoded. The version byte lets us migrate
 * the algorithm in place later (new version = new cipher, old version =
 * read-only decryption path) without breaking historical rows.
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const envelope = Buffer.concat([Buffer.from([VERSION]), iv, tag, enc]);
  return envelope.toString("base64");
}

/**
 * Decrypt a ciphertext previously produced by `encryptSecret`. Throws on
 * tampering (GCM auth-tag mismatch) or on version mismatch.
 */
export function decryptSecret(ciphertextB64: string): string {
  const buf = Buffer.from(ciphertextB64, "base64");
  if (buf.length < 1 + IV_BYTES + AUTH_TAG_BYTES) {
    throw new Error("Ciphertext too short");
  }
  const version = buf[0];
  if (version !== VERSION) {
    throw new Error(`Unsupported crypto version: ${version}`);
  }
  const iv = buf.subarray(1, 1 + IV_BYTES);
  const tag = buf.subarray(1 + IV_BYTES, 1 + IV_BYTES + AUTH_TAG_BYTES);
  const enc = buf.subarray(1 + IV_BYTES + AUTH_TAG_BYTES);

  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
  return plain.toString("utf8");
}

/**
 * Return just the last four characters of the decrypted secret, with
 * leading dots — safe to render in the Integrations UI so users can
 * recognize which key they pasted without exposing the whole thing.
 */
export function maskSecret(ciphertextB64: string): string {
  try {
    const s = decryptSecret(ciphertextB64);
    const tail = s.slice(-4);
    return `••••${tail}`;
  } catch {
    return "••••";
  }
}
