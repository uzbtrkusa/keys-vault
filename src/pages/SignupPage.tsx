import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { deriveKey } from "../lib/crypto";
import { createVerifier } from "../lib/crypto";
import { toHex } from "../lib/bytea";
import { DEFAULT_KDF_PARAMS } from "../lib/types";
import { useSession } from "../session/SessionContext";
import { PasswordInput } from "../components/PasswordInput";
import { StrengthMeter, strengthScore } from "../components/StrengthMeter";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [masterPw, setMasterPw] = useState("");
  const [masterPw2, setMasterPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<null | { email: string; saltHex: string; url: string }>(null);
  const nav = useNavigate();
  const { setKey } = useSession();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (masterPw.length < 8) return setErr("Master password must be at least 8 characters.");
    if (strengthScore(masterPw) < 2) return setErr("Master password too weak — pick something less obvious.");
    if (masterPw !== masterPw2) return setErr("Master passwords don't match.");

    setBusy(true);
    try {
      // 1. Create Supabase user
      const { data: signUp, error: suErr } = await supabase.auth.signUp({
        email, password: loginPw,
      });
      if (suErr) throw suErr;
      const userId = signUp.user?.id;
      if (!userId) throw new Error("Signup did not return a user id (check email confirmation settings).");

      // 2. Generate salt, derive key, make verifier
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKey(masterPw, salt, DEFAULT_KDF_PARAMS);
      const verifier = await createVerifier(key);

      // 3. Insert vault_meta
      const { error: metaErr } = await supabase.from("vault_meta").insert({
        user_id: userId,
        salt: toHex(salt),
        kdf_params: DEFAULT_KDF_PARAMS,
        verifier: toHex(new Uint8Array(verifier)),
      });
      if (metaErr) throw metaErr;

      // 4. Unlock session and show recovery sheet
      setKey(key);
      setRecovery({
        email,
        saltHex: [...salt].map(b => b.toString(16).padStart(2, "0")).join(""),
        url: window.location.origin,
      });
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  if (recovery) {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-semibold mb-2">Save your recovery info</h1>
        <p className="text-sm text-slate-600 mb-4">
          Write this down and store it somewhere safe. If you lose your master
          password, <strong>there is no recovery</strong>.
        </p>
        <div className="rounded border bg-white p-4 text-sm space-y-2">
          <div><span className="text-slate-500">Email:</span> {recovery.email}</div>
          <div><span className="text-slate-500">App URL:</span> {recovery.url}</div>
          <div className="break-all"><span className="text-slate-500">Salt (hex):</span> {recovery.saltHex}</div>
          <div className="text-slate-500">Master password: [write yours here]</div>
        </div>
        <button className="mt-4 rounded bg-slate-900 px-4 py-2 text-white" onClick={() => nav("/")}>
          I have saved this — continue
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md p-6 space-y-3">
      <h1 className="text-xl font-semibold">Create your vault</h1>
      <label className="block">
        <span className="text-sm">Email</span>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
          className="w-full rounded border border-slate-300 p-2" />
      </label>
      <label className="block">
        <span className="text-sm">Login password (for Supabase)</span>
        <PasswordInput required value={loginPw} onChange={e => setLoginPw((e.target as HTMLInputElement).value)} />
      </label>
      <label className="block">
        <span className="text-sm">Master password (encrypts your vault)</span>
        <PasswordInput required minLength={8} value={masterPw} onChange={e => setMasterPw((e.target as HTMLInputElement).value)} />
        <StrengthMeter password={masterPw} />
      </label>
      <label className="block">
        <span className="text-sm">Confirm master password</span>
        <PasswordInput required minLength={8} value={masterPw2} onChange={e => setMasterPw2((e.target as HTMLInputElement).value)} />
      </label>
      {err && <div className="rounded bg-red-100 p-2 text-sm text-red-800">{err}</div>}
      <button disabled={busy} className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
        {busy ? "Creating…" : "Create vault"}
      </button>
      <div className="text-sm text-slate-600">
        Already have a vault? <Link to="/login" className="underline">Sign in</Link>
      </div>
    </form>
  );
}
