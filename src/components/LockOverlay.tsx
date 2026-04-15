import { useState } from "react";
import { supabase } from "../lib/supabase";
import { deriveKey, checkVerifier } from "../lib/crypto";
import type { KdfParams } from "../lib/types";
import { useSession } from "../session/SessionContext";
import { PasswordInput } from "./PasswordInput";

export function LockOverlay() {
  const { setKey } = useSession();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onUnlock(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const { data: meta, error } = await supabase.from("vault_meta")
        .select("salt, kdf_params, verifier").single();
      if (error) throw error;
      const key = await deriveKey(pw, new Uint8Array(meta.salt), meta.kdf_params as KdfParams);
      const ok = await checkVerifier(key, new Uint8Array(meta.verifier).buffer);
      if (!ok) { setErr("Wrong master password."); return; }
      setKey(key);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur flex items-center justify-center p-4 z-50">
      <form onSubmit={onUnlock} className="bg-white rounded-lg p-5 w-full max-w-sm space-y-3">
        <h2 className="font-semibold">🔒 Vault locked</h2>
        <p className="text-sm text-slate-600">Enter master password to resume.</p>
        <PasswordInput autoFocus value={pw} onChange={e => setPw((e.target as HTMLInputElement).value)} />
        {err && <div className="text-red-700 text-sm">{err}</div>}
        <button disabled={busy} className="w-full rounded bg-slate-900 text-white px-4 py-2 disabled:opacity-50">
          {busy ? "Deriving key…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
