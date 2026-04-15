import { argon2id } from "hash-wasm";
import type { KdfParams } from "../types";

/**
 * Derives a 32-byte AES key from a master password using argon2id.
 * Runs entirely in-browser. Never sent over the network.
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  params: KdfParams
): Promise<ArrayBuffer> {
  const hex = await argon2id({
    password,
    salt,
    parallelism: params.parallelism,
    iterations: params.time,
    memorySize: params.memory,
    hashLength: 32,
    outputType: "hex",
  });
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  return bytes.buffer;
}
