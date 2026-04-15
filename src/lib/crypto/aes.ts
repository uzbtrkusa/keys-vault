const ALGO = "AES-GCM";

async function importKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, ALGO, false, ["encrypt", "decrypt"]);
}

export function randomIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

export async function encryptJson(
  key: ArrayBuffer,
  iv: Uint8Array,
  payload: unknown
): Promise<ArrayBuffer> {
  const k = await importKey(key);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  return crypto.subtle.encrypt({ name: ALGO, iv: iv as BufferSource }, k, plaintext as BufferSource);
}

export async function decryptJson<T = unknown>(
  key: ArrayBuffer,
  iv: Uint8Array | ArrayBuffer,
  ciphertext: ArrayBuffer
): Promise<T> {
  const k = await importKey(key);
  const ivBytes = iv instanceof Uint8Array ? iv : new Uint8Array(iv);
  const pt = await crypto.subtle.decrypt({ name: ALGO, iv: ivBytes as BufferSource }, k, ciphertext);
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}
