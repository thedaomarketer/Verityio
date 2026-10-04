import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for Plaid access tokens at rest. The key is 32
 * random bytes, base64-encoded in BANK_TOKEN_ENCRYPTION_KEY (generate one
 * with `openssl rand -base64 32`); it lives only in the app's environment,
 * never in the database, so a database leak alone doesn't expose tokens.
 *
 * Format: "v1.<iv>.<auth tag>.<ciphertext>", each part base64url.
 */

const VERSION = "v1";

export function parseEncryptionKey(value: string | undefined | null): Buffer | null {
  if (!value?.trim()) return null;
  const key = Buffer.from(value.trim(), "base64");
  return key.length === 32 ? key : null;
}

export function encryptToken(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

/** Throws if the value was tampered with or encrypted under a different key. */
export function decryptToken(value: string, key: Buffer): string {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error("Unrecognised token format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
