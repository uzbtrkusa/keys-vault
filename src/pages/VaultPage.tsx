import { useMemo, useState, useCallback } from "react";
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
import { useTheme } from "../hooks/useTheme";

// ── Sun / Moon icons ──────────────────────────────────────────────────────────

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VaultPage() {
  const { data: rows, isLoading, error } = useVaultRows();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("name");
  const { lock } = useSession();
  const others = usePresence();
  const { theme, toggle: toggleTheme } = useTheme();

  // ── Expansion state ───────────────────────────────────────────────────────
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showNewRow,  setShowNewRow]  = useState(false);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onDuplicateSaved = useCallback((newId: string) => {
    setExpandedIds(prev => new Set([...prev, newId]));
  }, []);

  const onDiscardNew = useCallback(() => {
    setShowNewRow(false);
  }, []);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(
    () => filterRows(rows ?? [], query, scope),
    [rows, query, scope],
  );

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Notes
        </h1>
        <div className="flex items-center gap-3">
          {/* Theme toggle — small, icon only */}
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded-md p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link
            to="/settings"
            className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 underline-offset-2 hover:underline transition-colors"
          >
            Settings
          </Link>
          <button
            onClick={lock}
            className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 underline-offset-2 hover:underline transition-colors"
          >
            Lock
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 underline-offset-2 hover:underline transition-colors"
          >
            Log out
          </button>
        </div>
      </div>

      <PresenceBanner others={others} />

      {/* Search + scope on one row */}
      <div className="flex items-center gap-2">
        <ScopePicker value={scope} onChange={setScope} />
        <div className="flex-1">
          <SearchBar value={query} onChange={setQuery} />
        </div>
      </div>

      {isLoading && (
        <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {(error as Error).message}
        </div>
      )}

      {!isLoading && rows && (
        <RowList
          rows={filtered}
          query={query}
          expandedIds={expandedIds}
          onToggle={toggleExpanded}
          showNewRow={showNewRow}
          onDiscardNew={onDiscardNew}
          onDuplicateSaved={onDuplicateSaved}
        />
      )}

      {/* Sticky bottom bar: result count centered, Add note on the right */}
      <div className="sticky bottom-4 flex items-center">
        <div className="flex-1" />
        <div className="flex-1 flex justify-center">
          <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
            {filtered.length.toLocaleString()} result{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex-1 flex justify-end">
          <button
            onClick={() => setShowNewRow(true)}
            className="flex items-center gap-1.5 rounded-full bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-medium text-white dark:text-slate-900 shadow-lg hover:bg-slate-700 dark:hover:bg-slate-200 active:scale-95 transition-all"
          >
            <span className="text-base leading-none">+</span>
            Add note
          </button>
        </div>
      </div>

    </div>
  );
}
