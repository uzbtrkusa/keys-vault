import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useVaultRows } from "../vault/useVaultRows";
import { filterRows } from "../lib/search";
import { SearchBar } from "../components/SearchBar";
import { ScopePicker } from "../components/ScopePicker";
import { RowList } from "../components/RowList";
import type { SearchScope } from "../lib/types";
import { useSession } from "../session/SessionContext";
import { supabase } from "../lib/supabase";
import { usePresence } from "../vault/usePresence";
import { PresenceBanner } from "../components/PresenceBanner";

export default function VaultPage() {
  const { data: rows, isLoading, error } = useVaultRows();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const { lock } = useSession();
  const others = usePresence();

  const filtered = useMemo(() => filterRows(rows ?? [], query, scope), [rows, query, scope]);

  return (
    <div className="mx-auto max-w-2xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">🔒 Keys</h1>
        <div className="flex gap-2">
          <Link to="/settings" className="text-sm underline">Settings</Link>
          <button onClick={lock} className="text-sm underline">Lock</button>
          <button onClick={() => supabase.auth.signOut()} className="text-sm underline">Log out</button>
        </div>
      </div>
      <PresenceBanner others={others} />
      <SearchBar value={query} onChange={setQuery} />
      <div className="flex items-center justify-between text-sm text-slate-600">
        <div className="flex items-center gap-2">
          Scope: <ScopePicker value={scope} onChange={setScope} />
        </div>
        <div>{filtered.length} result{filtered.length === 1 ? "" : "s"}</div>
      </div>
      {isLoading && <div>Loading…</div>}
      {error && <div className="text-red-700">{(error as Error).message}</div>}
      {!isLoading && rows && <RowList rows={filtered} query={query} />}
      <div className="sticky bottom-3 flex justify-end">
        <Link to="/edit/new" className="rounded-full bg-slate-900 px-4 py-2 text-white shadow">+ Add row</Link>
      </div>
    </div>
  );
}
