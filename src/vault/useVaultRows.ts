import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { decryptJson } from "../lib/crypto";
import { useSession } from "../session/SessionContext";
import type { VaultRow, VaultRowPlain } from "../lib/types";
import { useEffect } from "react";

async function fetchAndDecrypt(key: ArrayBuffer): Promise<VaultRow[]> {
  const { data, error } = await supabase
    .from("vault_rows")
    .select("id, ciphertext, iv, version, updated_at");
  if (error) throw error;
  const out: VaultRow[] = [];
  for (const r of data ?? []) {
    const iv = new Uint8Array(r.iv);
    const ct = new Uint8Array(r.ciphertext).buffer;
    try {
      const pt = await decryptJson<VaultRowPlain>(key, iv, ct);
      out.push({
        id: r.id,
        version: r.version,
        updatedAt: r.updated_at,
        group: pt.group ?? "",
        name: pt.name ?? "",
        note: pt.note ?? "",
      });
    } catch {
      // Skip rows that fail to decrypt — log for diagnostics
      console.warn("Failed to decrypt row", r.id);
    }
  }
  return out;
}

export function useVaultRows() {
  const { key, setRows } = useSession();
  const q = useQuery({
    queryKey: ["vault_rows"],
    queryFn: () => fetchAndDecrypt(key!),
    enabled: !!key,
    staleTime: Infinity,
  });
  // Push decrypted rows into SessionContext so they clear on lock.
  useEffect(() => {
    if (q.data) setRows(q.data);
  }, [q.data, setRows]);
  return q;
}
