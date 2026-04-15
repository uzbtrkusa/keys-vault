import { describe, it, expect } from "vitest";
import { deriveKey } from "../src/lib/crypto/kdf";
import { DEFAULT_KDF_PARAMS } from "../src/lib/types";

describe("deriveKey", () => {
  it("produces a 32-byte key", async () => {
    const salt = new Uint8Array(16).fill(7);
    const key = await deriveKey("correct horse battery staple", salt, DEFAULT_KDF_PARAMS);
    expect(key.byteLength).toBe(32);
  });

  it("is deterministic for same inputs", async () => {
    const salt = new Uint8Array(16).fill(9);
    const k1 = await deriveKey("pw", salt, DEFAULT_KDF_PARAMS);
    const k2 = await deriveKey("pw", salt, DEFAULT_KDF_PARAMS);
    expect(new Uint8Array(k1)).toEqual(new Uint8Array(k2));
  });

  it("produces different keys for different passwords", async () => {
    const salt = new Uint8Array(16).fill(1);
    const k1 = await deriveKey("pw1", salt, DEFAULT_KDF_PARAMS);
    const k2 = await deriveKey("pw2", salt, DEFAULT_KDF_PARAMS);
    expect(new Uint8Array(k1)).not.toEqual(new Uint8Array(k2));
  });
});
