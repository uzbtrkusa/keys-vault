import { useEffect, useRef, useState } from "react";
import type { VaultRow } from "../lib/types";
import { highlightSpans } from "../lib/search";
import { useAddRow, useUpdateRow, useDeleteRow, ConflictError } from "./useVaultMutations";

// ── Highlight helper ──────────────────────────────────────────────────────────

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

  const [savedFlash,    setSavedFlash]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [conflict,      setConflict]      = useState<VaultRow | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [duplicating,   setDuplicating]   = useState(false);

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

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
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setSavedFlash(false), 2000);
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
    if (!row || duplicating) return;
    setDuplicating(true);
    setError(null);
    try {
      const newId = await add.mutateAsync({
        group: localGroup,
        name: localName,
        note: localNote,
      });
      onDuplicateSaved(newId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDuplicating(false);
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
      <button
        onClick={onToggle}
        className="w-full text-left rounded border bg-white p-3 hover:bg-slate-50 cursor-pointer"
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
      </button>
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
              disabled={saving}
              className="underline text-slate-700 disabled:opacity-50"
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
                disabled={duplicating}
                className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
              >
                {duplicating ? "Duplicating…" : "Duplicate"}
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
                disabled={del.isPending}
                className="font-medium text-red-700 hover:underline disabled:opacity-50"
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
