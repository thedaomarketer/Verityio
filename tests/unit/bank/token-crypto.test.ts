import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { decryptToken, encryptToken, parseEncryptionKey } from "@/lib/bank/token-crypto";

const key = randomBytes(32);

describe("bank token encryption", () => {
  it("round-trips a token", () => {
    const token = "access-sandbox-1234-abcd";
    const sealed = encryptToken(token, key);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain(token);
    expect(decryptToken(sealed, key)).toBe(token);
  });

  it("uses a fresh IV every time", () => {
    expect(encryptToken("same", key)).not.toBe(encryptToken("same", key));
  });

  it("rejects tampering and the wrong key", () => {
    const sealed = encryptToken("secret", key);
    const parts = sealed.split(".");
    const flipped = Buffer.from(parts[3], "base64url");
    flipped[0] ^= 1;
    expect(() => decryptToken([parts[0], parts[1], parts[2], flipped.toString("base64url")].join("."), key)).toThrow();
    expect(() => decryptToken(sealed, randomBytes(32))).toThrow();
    expect(() => decryptToken("not-a-token", key)).toThrow();
  });

  it("only accepts a 32-byte base64 key", () => {
    expect(parseEncryptionKey(key.toString("base64"))?.equals(key)).toBe(true);
    expect(parseEncryptionKey(randomBytes(16).toString("base64"))).toBeNull();
    expect(parseEncryptionKey("")).toBeNull();
    expect(parseEncryptionKey(undefined)).toBeNull();
  });
});
