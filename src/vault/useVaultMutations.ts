import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { encryptJson, randomIv } from "../lib/crypto";
import { useSession } from "../session/SessionContext";
import type { VaultRow, VaultRowPlain } from "../lib/types";

export class ConflictError extends Error {
  latest: VaultRow;
  constructor(latest: VaultRow) { super("version conflict"); this.latest = latest; }
}

export function useAddRow() {
  const { key } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: VaultRowPlain) => {
      const iv = randomIv();
      const ct = await encryptJson(key!, iv, payload);
      const { error } = await supabase.from("vault_rows").insert({
        ciphertext: new Uint8Array(ct),
        iv,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault_rows"] }),
  });
}

export function useUpdateRow() {
  const { key } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; version: number; payload: VaultRowPlain }) => {
      const iv = randomIv();
      const ct = await encryptJson(key!, iv, args.payload);
      const { data, error } = await supabase
        .from("vault_rows")
        .update({
          ciphertext: new Uint8Array(ct),
          iv,
          version: args.version + 1,
        })
        .eq("id", args.id)
        .eq("version", args.version)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        // Conflict — fetch latest and throw ConflictError.
        const { data: latest } = await supabase
          .from("vault_rows")
          .select("id, ciphertext, iv, version, updated_at")
          .eq("id", args.id)
          .single();
        if (latest) {
          const { decryptJson } = await import("../lib/crypto");
          const pt = await decryptJson<VaultRowPlain>(
            key!, new Uint8Array(latest.iv), new Uint8Array(latest.ciphertext).buffer
          );
          throw new ConflictError({
            id: latest.id, version: latest.version, updatedAt: latest.updated_at,
            group: pt.group, name: pt.name, note: pt.note,
          });
        }
        throw new Error("Update failed: row missing.");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault_rows"] }),
  });
}

export function useDeleteRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; version: number }) => {
      const { data, error } = await supabase
        .from("vault_rows")
        .delete()
        .eq("id", args.id)
        .eq("version", args.version)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Row was modified elsewhere; refresh and try again.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault_rows"] }),
  });
}
