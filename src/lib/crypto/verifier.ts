import { encryptJson, decryptJson, randomIv } from "./aes";

const MAGIC = { verify: "keys-vault-v1" } as const;

/** Verifier = [12-byte IV][ciphertext] concatenated into one blob. */
export async function createVerifier(key: ArrayBuffer): Promise<ArrayBuffer> {
  const iv = randomIv();
  const ct = await encryptJson(key, iv, MAGIC);
  const out = new Uint8Array(iv.byteLength + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.byteLength);
  return out.buffer;
}

export async function checkVerifier(
  key: ArrayBuffer,
  verifier: ArrayBuffer
): Promise<boolean> {
  try {
    const v = new Uint8Array(verifier);
    const iv = v.slice(0, 12);
    const ct = v.slice(12).buffer;
    const payload = await decryptJson<typeof MAGIC>(key, iv, ct);
    return payload?.verify === MAGIC.verify;
  } catch {
    return false;
  }
}
