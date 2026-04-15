import { describe, it, expect } from "vitest";
import { encryptJson, decryptJson, randomIv } from "../src/lib/crypto/aes";

async function aKey(): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes.buffer;
}

describe("AES-GCM encrypt/decrypt", () => {
  it("round-trips a JSON payload", async () => {
    const key = await aKey();
    const iv = randomIv();
    const payload = { group: "G", name: "N", note: "hello world" };
    const ct = await encryptJson(key, iv, payload);
    const pt = await decryptJson(key, iv, ct);
    expect(pt).toEqual(payload);
  });

  it("fails to decrypt with wrong key", async () => {
    const k1 = await aKey();
    const k2 = await aKey();
    const iv = randomIv();
    const ct = await encryptJson(k1, iv, { group: "", name: "", note: "x" });
    await expect(decryptJson(k2, iv, ct)).rejects.toThrow();
  });

  it("fails to decrypt if ciphertext tampered", async () => {
    const key = await aKey();
    const iv = randomIv();
    const ct = await encryptJson(key, iv, { group: "", name: "", note: "x" });
    const tampered = new Uint8Array(ct);
    tampered[0] ^= 0xff;
    await expect(decryptJson(key, iv, tampered.buffer)).rejects.toThrow();
  });

  it("randomIv returns 12 bytes", () => {
    expect(randomIv().byteLength).toBe(12);
  });
});
