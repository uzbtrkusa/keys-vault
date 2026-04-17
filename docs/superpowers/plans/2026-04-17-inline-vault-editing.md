# Inline Vault Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate `/edit/:id` page with expand-in-place inline editing directly from the vault list, so search results persist and scroll position is never lost.

**Architecture:** `VaultPage` gains a `Set<string>` of expanded row IDs; a new `RowItem` component renders each row as either a collapsed card or an expanded edit form with auto-save on collapse. `EditRowPage` and the `/edit/:id` route are removed entirely.

**Tech Stack:** React 18, TypeScript, TanStack Query, TanStack Virtual, Tailwind CSS, Supabase, existing `useVaultMutations` hooks.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/vault/useVaultMutations.ts` | `useAddRow` must return the new row's ID (needed for duplicate expand) |
| Create | `src/vault/RowItem.tsx` | Collapsed card + expanded edit form; owns auto-save, delete, duplicate, new-row logic |
| Modify | `src/components/RowList.tsx` | Use `RowItem` instead of `RowCard`; accept expansion state props; remove navigation |
| Modify | `src/pages/VaultPage.tsx` | Manage `expandedIds` Set and `showNewRow`; pass to `RowList`; "+ Add row" button sets `showNewRow=true` |
| Modify | `src/App.tsx` | Remove `/edit/:id` route and `EditRowPage` import |
| Delete | `src/pages/EditRowPage.tsx` | No longer needed |
| Delete | `src/components/ConflictModal.tsx` | Conflict UI moves inline into `RowItem` |

---

## Task 1: Update `useAddRow` to Return the New Row's ID

**Why:** When duplicating a row, `RowItem` needs the new row's Supabase ID to immediately expand it.

**Files:**
- Modify: `src/vault/useVaultMutations.ts`

- [ ] **Step 1: Update `useAddRow` mutationFn to select and return the inserted row's ID**

Replace the entire `useAddRow` function in `src/vault/useVaultMutations.ts`:

```typescript
export function useAddRow() {
  const { key } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: VaultRowPlain): Promise<string> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const iv = randomIv();
      const ct = await encryptJson(key!, iv, payload);
      const { data, error } = await supabase.from("vault_rows").insert({
        user_id: user.id,
        ciphertext: toHex(new Uint8Array(ct)),
        iv: toHex(iv),
      }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault_rows"] }),
  });
}
```

- [ ] **Step 2: Type-check**

```bash
cd C:\Users\azizb\Documents\Projects\keys-vault
npx tsc --noEmit
```

Expected: no errors (the return type change only affects callers that expect `void`; none do yet).

- [ ] **Step 3: Commit**

```bash
git add src/vault/useVaultMutations.ts
git commit -m "feat: useAddRow returns new row id for duplicate-expand"
```

---

## Task 2: Create `src/vault/RowItem.tsx`

This is the core new component. It renders as a collapsed card or an expanded edit form. It owns all row-level interactions: toggle expand, auto-save on collapse, delete with inline confirm, duplicate, conflict resolution, and new-row creation.

**Files:**
- Create: `src/vault/RowItem.tsx`

- [ ] **Step 1: Create the file with the full implementation**

Create `src/vault/RowItem.tsx` with this content:

```typescript
import { useEffect, useState } from "react";
import type { VaultRow } from "../lib/types";
import { highlightSpans } from "../lib/search";
import { useAddRow, useUpdateRow, useDeleteRow, ConflictError } from "./useVaultMutations";

// ── Highlight helper (same logic as old RowCard) ──────────────────────────────

function HL({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const spans = highlightSpans(text, query);
  if (spans.length === 0) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach(([s, l], i) => {
    if (cursor < s) out.push(<span key={`t${i}`}>{text.slice(cursor, s)}</span>);
    out.push(<mark key={`m${i}`} className="bg-yellow-200 rounded px-0.5">{text.slice(s, s + l)}</mark>);
    cursor = s + l;
  });
  if (cursor < text.length) out.push(<span key="tail">{text.slice(cursor)}</span>);
  return <>{out}</>;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RowItemProps {
  /** null = unsaved new row being created */
  row: VaultRow | null;
  isExpanded: boolean;
  /** Called when the user wants to toggle collapse/expand.
   *  For existing rows: parent flips the ID in expandedIds.
   *  For new rows: parent sets showNewRow=false (discard or post-save). */
  onToggle: () => void;
  /** Called after a duplicate saves successfully, with the new row's Supabase ID. */
  onDuplicateSaved: (newId: string) => void;
  query: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RowItem({ row, isExpanded, onToggle, onDuplicateSaved, query }: RowItemProps) {
  const [localGroup, setLocalGroup] = useState(row?.group ?? "");
  const [localName,  setLocalName]  = useState(row?.name  ?? "");
  const [localNote,  setLocalNote]  = useState(row?.note  ?? "");

  const [savedFlash,     setSavedFlash]     = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [conflict,       setConflict]       = useState<VaultRow | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  const upd = useUpdateRow();
  const add = useAddRow();
  const del = useDeleteRow();

  // Reset local fields each time the row opens (not on every row update —
  // we don't want to wipe mid-edit if a realtime event fires).
  useEffect(() => {
    if (isExpanded) {
      setLocalGroup(row?.group ?? "");
      setLocalName(row?.name  ?? "");
      setLocalNote(row?.note  ?? "");
      setError(null);
      setConflict(null);
      setConfirmDelete(false);
    }
  }, [isExpanded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Collapse handler (auto-save) ───────────────────────────────────────────

  async function handleCollapse() {
    if (saving) return;

    // ── New row path ──
    if (!row) {
      const hasContent = localGroup.trim() || localName.trim() || localNote.trim();
      if (!hasContent) { onToggle(); return; }       // discard empty
      setSaving(true);
      try {
        await add.mutateAsync({ group: localGroup, name: localName, note: localNote });
        onToggle();                                   // hide the new-row card
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
      return;
    }

    // ── Existing row path ──
    const changed =
      localGroup !== row.group ||
      localName  !== row.name  ||
      localNote  !== row.note;

    if (!changed) { onToggle(); return; }            // nothing to save

    setSaving(true);
    try {
      await upd.mutateAsync({
        id: row.id,
        version: row.version,
        payload: { group: localGroup, name: localName, note: localNote },
      });
      onToggle();                                    // collapse
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      if (e instanceof ConflictError) setConflict(e.latest);
      else setError((e as Error).message);
      // stay expanded — do not call onToggle()
    } finally {
      setSaving(false);
    }
  }

  // ── Duplicate ──────────────────────────────────────────────────────────────

  async function handleDuplicate() {
    if (!row) return;
    setError(null);
    try {
      const newId = await add.mutateAsync({
        group: localGroup,
        name: localName,
        note: localNote,
      });
      onDuplicateSaved(newId);   // parent adds newId to expandedIds
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!row) return;
    setError(null);
    try {
      await del.mutateAsync({ id: row.id, version: row.version });
      // row disappears from list via invalidateQueries — no need to call onToggle
    } catch (e) {
      setError((e as Error).message);
      setConfirmDelete(false);
    }
  }

  // ── Conflict resolution ────────────────────────────────────────────────────

  async function handleOverwrite() {
    if (!conflict) return;
    setSaving(true);
    setError(null);
    try {
      await upd.mutateAsync({
        id: conflict.id,
        version: conflict.version,
        payload: { group: localGroup, name: localName, note: localNote },
      });
      setConflict(null);
      onToggle();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleDiscardMine() {
    if (!conflict) return;
    setLocalGroup(conflict.group);
    setLocalName(conflict.name);
    setLocalNote(conflict.note);
    setConflict(null);
    onToggle();                  // collapse with server's values
  }

  // ── Collapsed view ─────────────────────────────────────────────────────────

  if (!isExpanded) {
    return (
      <div
        onClick={onToggle}
        className="rounded border bg-white p-3 hover:bg-slate-50 cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="font-medium">
            <HL text={row?.name || "(unnamed)"} query={query} />
          </div>
          {savedFlash && (
            <span className="text-xs text-green-600 font-medium">Saved ✓</span>
          )}
        </div>
        <div className="text-xs text-slate-500 truncate">
          <HL text={row?.group || ""} query={query} />
          {row?.group && row?.note ? " · " : ""}
          <HL text={row?.note || ""} query={query} />
        </div>
      </div>
    );
  }

  // ── Expanded view ──────────────────────────────────────────────────────────

  return (
    <div className="rounded border border-slate-300 bg-white shadow-sm">

      {/* Header — click collapses and triggers auto-save */}
      <button
        onClick={handleCollapse}
        disabled={saving}
        className="w-full flex items-center justify-between px-3 py-2 text-left font-medium hover:bg-slate-50 disabled:opacity-50 border-b border-slate-100"
      >
        <span>▲ {row?.name || localName || "New entry"}</span>
        {saving && <span className="text-xs text-slate-400">Saving…</span>}
      </button>

      <div className="px-3 pb-3 pt-2 space-y-2">

        <label className="block">
          <span className="text-xs text-slate-400 uppercase tracking-wide">Group</span>
          <input
            value={localGroup}
            onChange={e => setLocalGroup(e.target.value)}
            className="w-full rounded border border-slate-300 p-1.5 text-sm mt-0.5"
          />
        </label>

        <label className="block">
          <span className="text-xs text-slate-400 uppercase tracking-wide">Name</span>
          <input
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            className="w-full rounded border border-slate-300 p-1.5 text-sm mt-0.5"
          />
        </label>

        <label className="block">
          <span className="text-xs text-slate-400 uppercase tracking-wide">Note</span>
          <textarea
            value={localNote}
            onChange={e => setLocalNote(e.target.value)}
            rows={4}
            className="w-full rounded border border-slate-300 p-1.5 text-sm font-mono resize-y mt-0.5"
          />
        </label>

        {/* Generic error */}
        {error && (
          <div className="text-sm text-red-700 rounded bg-red-50 border border-red-200 p-2">
            {error}
          </div>
        )}

        {/* Conflict banner */}
        {conflict && (
          <div className="rounded bg-amber-50 border border-amber-200 p-2 text-sm">
            <span className="font-medium text-amber-800">Someone else saved changes.</span>{" "}
            <button
              onClick={handleOverwrite}
              disabled={saving}
              className="underline text-slate-700 disabled:opacity-50"
            >
              Overwrite
            </button>
            {" · "}
            <button
              onClick={handleDiscardMine}
              className="underline text-slate-700"
            >
              Discard mine
            </button>
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between pt-1">

          {/* Left: Duplicate (existing rows) or Discard (new row) */}
          <div>
            {row && (
              <button
                onClick={handleDuplicate}
                className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
              >
                Duplicate
              </button>
            )}
            {!row && (
              <button
                onClick={onToggle}
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
              >
                Discard
              </button>
            )}
          </div>

          {/* Right: Delete (existing rows only) */}
          {row && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-red-600 hover:underline"
            >
              Delete
            </button>
          )}
          {row && confirmDelete && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600">Delete this row?</span>
              <button
                onClick={handleDelete}
                className="font-medium text-red-700 hover:underline"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-slate-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd C:\Users\azizb\Documents\Projects\keys-vault
npx tsc --noEmit
```

Expected: no errors. `RowItem` is not yet imported anywhere so nothing is broken.

- [ ] **Step 3: Commit**

```bash
git add src/vault/RowItem.tsx
git commit -m "feat: add RowItem component with inline expand/edit/save/delete/duplicate"
```

---

## Task 3: Update `src/components/RowList.tsx`

Replace `RowCard` with `RowItem`; accept expansion state from parent; render new-row card at top; update keyboard handler.

**Files:**
- Modify: `src/components/RowList.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import type { VaultRow } from "../lib/types";
import { RowItem } from "../vault/RowItem";

interface RowListProps {
  rows: VaultRow[];
  query: string;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  showNewRow: boolean;
  onDiscardNew: () => void;
  onDuplicateSaved: (newId: string) => void;
}

export function RowList({
  rows,
  query,
  expandedIds,
  onToggle,
  showNewRow,
  onDiscardNew,
  onDuplicateSaved,
}: RowListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);

  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 8,
  });

  // Reset selection when query or result count changes.
  useEffect(() => { setSelected(0); }, [query, rows.length]);

  // Keyboard navigation.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // While typing in a field, only handle Escape.
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        if (e.key === "Escape") (document.activeElement as HTMLElement).blur();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected(s => Math.min(s + 1, rows.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(s => Math.max(s - 1, 0));
      }
      // Enter now toggles expand/collapse instead of navigating.
      if (e.key === "Enter" && rows[selected]) {
        e.preventDefault();
        onToggle(rows[selected].id);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [rows, selected, onToggle]);

  // Keep selected row in view.
  useEffect(() => { v.scrollToIndex(selected, { align: "auto" }); }, [selected, v]);

  return (
    <div>
      {/* New-row card rendered above the virtualized list */}
      {showNewRow && (
        <div className="mb-2">
          <RowItem
            row={null}
            isExpanded={true}
            onToggle={onDiscardNew}
            onDuplicateSaved={onDuplicateSaved}
            query={query}
          />
        </div>
      )}

      {/* Virtualized list */}
      <div ref={parentRef} className="h-[70vh] overflow-auto">
        <div style={{ height: v.getTotalSize(), position: "relative" }}>
          {v.getVirtualItems().map(vi => (
            <div
              key={vi.key}
              ref={v.measureElement}
              data-index={vi.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vi.start}px)`,
              }}
              className="p-1"
            >
              <div className={vi.index === selected ? "ring-2 ring-slate-900 rounded" : ""}>
                <RowItem
                  row={rows[vi.index]}
                  isExpanded={expandedIds.has(rows[vi.index].id)}
                  onToggle={() => onToggle(rows[vi.index].id)}
                  onDuplicateSaved={onDuplicateSaved}
                  query={query}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors on `VaultPage` because it still passes the old props (`rows` and `query` only) to `RowList`. That's fine — we fix it in the next task.

- [ ] **Step 3: Commit**

```bash
git add src/components/RowList.tsx
git commit -m "feat: RowList uses RowItem, accepts expansion state, Enter key toggles expand"
```

---

## Task 4: Update `src/pages/VaultPage.tsx`

Add `expandedIds` Set and `showNewRow` state; wire all callbacks; change "+ Add row" from a link to a button.

**Files:**
- Modify: `src/pages/VaultPage.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
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

export default function VaultPage() {
  const { data: rows, isLoading, error } = useVaultRows();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const { lock } = useSession();
  const others = usePresence();

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

  // Called by RowItem after a duplicate saves — expand the new copy.
  const onDuplicateSaved = useCallback((newId: string) => {
    setExpandedIds(prev => new Set([...prev, newId]));
  }, []);

  // Called when the new-row card collapses (saved or discarded).
  const onDiscardNew = useCallback(() => {
    setShowNewRow(false);
  }, []);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(
    () => filterRows(rows ?? [], query, scope),
    [rows, query, scope],
  );

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

      <div className="sticky bottom-3 flex justify-end">
        <button
          onClick={() => setShowNewRow(true)}
          className="rounded-full bg-slate-900 px-4 py-2 text-white shadow"
        >
          + Add row
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. (App.tsx still imports EditRowPage — that's fine, it still exists.)

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: build succeeds. The app is now fully functional with inline editing.

- [ ] **Step 4: Manual smoke test in browser**

```bash
npm run dev
```

Open `http://localhost:5173`:
1. The vault list loads — rows appear as collapsed cards.
2. Click a row → it expands in place with Group, Name, Note fields pre-filled.
3. Edit the Note field → click the header (▲) → row collapses → "Saved ✓" appears for 2 seconds.
4. Click "+ Add row" → a blank expanded card appears at the top of the list → fill in fields → click header → card disappears → new row appears in the list.
5. Expand a row → click Duplicate → a duplicate appears immediately below as expanded.
6. Expand a row → click Delete → inline "Delete this row? Yes / Cancel" appears → click Yes → row disappears.
7. Search for a term → results filter → expand a result → edit → save → search results remain.
8. Arrow keys navigate the list; Enter toggles expand/collapse.

- [ ] **Step 5: Commit**

```bash
git add src/pages/VaultPage.tsx
git commit -m "feat: VaultPage wires inline expansion state and showNewRow"
```

---

## Task 5: Remove Old Code

Delete `EditRowPage.tsx` and `ConflictModal.tsx`; remove the `/edit/:id` route from `App.tsx`.

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/pages/EditRowPage.tsx`
- Delete: `src/components/ConflictModal.tsx`
- Delete: `src/components/RowCard.tsx` (replaced by `RowItem`; no longer imported anywhere)

- [ ] **Step 1: Delete the three old files**

```bash
rm src/pages/EditRowPage.tsx
rm src/components/ConflictModal.tsx
rm src/components/RowCard.tsx
```

- [ ] **Step 2: Replace `src/App.tsx` — remove the `/edit/:id` route and its imports**

```typescript
import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./session/SessionContext";
import { supabase } from "./lib/supabase";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import VaultPage from "./pages/VaultPage";
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
      <Route path="/signup"   element={sess ? <Navigate to="/" /> : <SignupPage />} />
      <Route path="/login"    element={sess ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/"         element={!sess ? <Navigate to="/login" /> : <Protected><VaultPage /></Protected>} />
      <Route path="/settings" element={!sess ? <Navigate to="/login" /> : <Protected><SettingsPage /></Protected>} />
      <Route path="*"         element={<Navigate to="/" />} />
    </Routes>
  );
}
```

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: clean compile, clean build. No references to `EditRowPage` or `ConflictModal` remain.

- [ ] **Step 4: Final deploy**

```bash
npx wrangler deploy --assets dist
```

Expected: deployment succeeds. Visit the live URL and repeat the smoke test from Task 4 Step 4.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git rm src/pages/EditRowPage.tsx src/components/ConflictModal.tsx src/components/RowCard.tsx
git commit -m "feat: remove EditRowPage, ConflictModal, RowCard — all editing is now inline"
```
