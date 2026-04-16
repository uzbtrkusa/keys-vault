import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { decryptJson } from "../lib/crypto";
import { fromBytea } from "../lib/bytea";
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
    const iv = fromBytea(r.iv);
    const ct = fromBytea(r.ciphertext).buffer;
    try {
      const pt = await decryptJson<VaultRowPlain>(key, iv, ct);
      out.push({
        id: r.id, version: r.version, updatedAt: r.updated_at,
        group: pt.group ?? "", name: pt.name ?? "", note: pt.note ?? "",
      });
    } catch {
      console.warn("Failed to decrypt row", r.id);
    }
  }
  return out;
}

export function useVaultRows() {
  const { key, setRows } = useSession();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["vault_rows"],
    queryFn: () => fetchAndDecrypt(key!),
    enabled: !!key,
    staleTime: Infinity,
  });

  useEffect(() => { if (q.data) setRows(q.data); }, [q.data, setRows]);

  // Realtime: invalidate on any vault_rows change for this user.
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      channel = supabase.channel(`rows:${uid}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table: "vault_rows", filter: `user_id=eq.${uid}` },
          () => qc.invalidateQueries({ queryKey: ["vault_rows"] })
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [key, qc]);

  return q;
}
