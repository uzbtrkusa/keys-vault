import { describe, it, expect } from "vitest";
import { createVerifier, checkVerifier } from "../src/lib/crypto/verifier";

async function aKey(): Promise<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(32)).buffer;
}

describe("verifier", () => {
  it("createVerifier + checkVerifier round-trip", async () => {
    const key = await aKey();
    const v = await createVerifier(key);
    const ok = await checkVerifier(key, v);
    expect(ok).toBe(true);
  });

  it("checkVerifier returns false for wrong key", async () => {
    const k1 = await aKey();
    const k2 = await aKey();
    const v = await createVerifier(k1);
    expect(await checkVerifier(k2, v)).toBe(false);
  });
});
