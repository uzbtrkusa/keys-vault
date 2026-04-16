import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { deriveKey, checkVerifier } from "../lib/crypto";
import { fromBytea } from "../lib/bytea";
import type { KdfParams } from "../lib/types";
import { useSession } from "../session/SessionContext";
import { PasswordInput } from "../components/PasswordInput";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [masterPw, setMasterPw] = useState("");
  const [stage, setStage] = useState<"creds" | "master">("creds");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  const { setKey } = useSession();

  async function onCreds(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: loginPw });
      if (error) throw error;
      setStage("master");
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function onMaster(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const { data: meta, error } = await supabase
        .from("vault_meta")
        .select("salt, kdf_params, verifier")
        .single();
      if (error) throw error;
      const salt = fromBytea(meta.salt);
      const params = meta.kdf_params as KdfParams;
      const verifier = fromBytea(meta.verifier).buffer;
      const key = await deriveKey(masterPw, salt, params);
      const ok = await checkVerifier(key, verifier);
      if (!ok) { setErr("Wrong master password."); setBusy(false); return; }
      setKey(key);
      nav("/");
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  if (stage === "creds") {
    return (
      <form onSubmit={onCreds} className="mx-auto max-w-md p-6 space-y-3">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <label className="block">
          <span className="text-sm">Email</span>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            className="w-full rounded border border-slate-300 p-2" />
        </label>
        <label className="block">
          <span className="text-sm">Login password</span>
          <PasswordInput required value={loginPw} onChange={e => setLoginPw((e.target as HTMLInputElement).value)} />
        </label>
        {err && <div className="rounded bg-red-100 p-2 text-sm text-red-800">{err}</div>}
        <button disabled={busy} className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
          {busy ? "Signing in…" : "Continue"}
        </button>
        <div className="text-sm text-slate-600">
          No vault yet? <Link to="/signup" className="underline">Create one</Link>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onMaster} className="mx-auto max-w-md p-6 space-y-3">
      <h1 className="text-xl font-semibold">Unlock vault</h1>
      <p className="text-sm text-slate-600">Enter your master password.</p>
      <PasswordInput autoFocus required value={masterPw} onChange={e => setMasterPw((e.target as HTMLInputElement).value)} />
      {err && <div className="rounded bg-red-100 p-2 text-sm text-red-800">{err}</div>}
      <button disabled={busy} className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
        {busy ? "Deriving key…" : "Unlock"}
      </button>
    </form>
  );
}
