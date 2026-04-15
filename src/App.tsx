import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./session/SessionContext";
import { supabase } from "./lib/supabase";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import VaultPage from "./pages/VaultPage";
import EditRowPage from "./pages/EditRowPage";
import SettingsPage from "./pages/SettingsPage";
import { LockOverlay } from "./components/LockOverlay";
import { useAutoLock } from "./session/useAutoLock";

function useSupabaseSession() {
  const [sess, setSess] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSess(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSess(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { sess, ready };
}

function Protected({ children }: { children: React.ReactNode }) {
  const { lockState } = useSession();
  return (
    <>
      {children}
      {lockState === "locked" && <LockOverlay />}
    </>
  );
}

export default function App() {
  const { sess, ready } = useSupabaseSession();
  useAutoLock();

  if (!ready) return <div className="p-4">Loading…</div>;

  return (
    <Routes>
      <Route path="/signup" element={sess ? <Navigate to="/" /> : <SignupPage />} />
      <Route path="/login" element={sess ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={!sess ? <Navigate to="/login" /> : <Protected><VaultPage /></Protected>} />
      <Route path="/edit/:id" element={!sess ? <Navigate to="/login" /> : <Protected><EditRowPage /></Protected>} />
      <Route path="/settings" element={!sess ? <Navigate to="/login" /> : <Protected><SettingsPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
