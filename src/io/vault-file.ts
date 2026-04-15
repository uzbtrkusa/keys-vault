import { deriveKey, decryptJson } from "../lib/crypto";
import type { KdfParams, VaultRowPlain } from "../lib/types";

/** v1 format: { version, salt_b64, kdf_params, rows: [{ iv_b64, ct_b64 }] } */
export interface VaultFileV1 {
  version: 1;
  salt_b64: string;
  kdf_params: KdfParams;
  rows: { iv_b64: string; ct_b64: string }[];
}

const toB64 = (a: ArrayBuffer | Uint8Array) => {
  const u = a instanceof Uint8Array ? a : new Uint8Array(a);
  let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
};
const fromB64 = (s: string) => {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};

/** Re-encrypts each row with the same key; callers should pass the current session key.
 *  (We don't just copy ciphertext because the on-server IV/ciphertext pairs are tied to
 *  the user's key already — for exports we reuse them directly for efficiency.) */
export function buildVaultFile(
  saltInMeta: Uint8Array,
  params: KdfParams,
  encryptedRows: { iv: Uint8Array; ciphertext: ArrayBuffer }[]
): VaultFileV1 {
  return {
    version: 1,
    salt_b64: toB64(saltInMeta),
    kdf_params: params,
    rows: encryptedRows.map(r => ({
      iv_b64: toB64(r.iv),
      ct_b64: toB64(r.ciphertext),
    })),
  };
}

/** Decrypt a .vault file in-browser under a supplied master password,
 *  returning plaintext rows the caller can then re-encrypt for their current user. */
export async function decryptVaultFile(
  file: VaultFileV1,
  masterPw: string
): Promise<VaultRowPlain[]> {
  const salt = fromB64(file.salt_b64);
  const key = await deriveKey(masterPw, salt, file.kdf_params);
  const out: VaultRowPlain[] = [];
  for (const r of file.rows) {
    const iv = fromB64(r.iv_b64);
    const ct = fromB64(r.ct_b64).buffer;
    const pt = await decryptJson<VaultRowPlain>(key, iv, ct);
    out.push(pt);
  }
  return out;
}
