/**
 * Supabase PostgREST returns bytea columns as hex strings with a \x prefix,
 * e.g. "\x3f4a2b...". This utility decodes them into a Uint8Array regardless
 * of whether the value is already a Uint8Array, ArrayBuffer, or hex string.
 */
export function fromBytea(v: unknown): Uint8Array {
  if (typeof v === "string") {
    const hex = v.startsWith("\\x") ? v.slice(2) : v;
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return arr;
  }
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return new Uint8Array(v as number[]);
}
