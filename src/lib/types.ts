/** Ciphertext row as stored in Supabase. */
export interface VaultRowCipher {
  id: string;
  user_id: string;
  ciphertext: ArrayBuffer;
  iv: ArrayBuffer;
  version: number;
  updated_at: string;
}

/** Decrypted payload of a row — the 3 fields the user edits. */
export interface VaultRowPlain {
  group: string;
  name: string;
  note: string;
}

/** Fully decrypted row as used in-memory by the UI. */
export interface VaultRow extends VaultRowPlain {
  id: string;
  version: number;
  updatedAt: string;
}

export interface VaultMeta {
  user_id: string;
  salt: Uint8Array;
  kdf_params: KdfParams;
  verifier: ArrayBuffer;
}

export interface KdfParams {
  type: "argon2id";
  memory: number;   // KiB
  time: number;     // iterations
  parallelism: number;
  version: 1;
}

export const DEFAULT_KDF_PARAMS: KdfParams = {
  type: "argon2id",
  memory: 65536,    // 64 MiB
  time: 3,
  parallelism: 1,
  version: 1,
};

export type SearchScope = "all" | "group" | "name" | "note";
