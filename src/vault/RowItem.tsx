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
    out.push(
      <mark key={`m${i}`} className="bg-yellow-200 dark:bg-yellow-700 dark:text-yellow-100 rounded px-0.5">
        {text.slice(s, s + l)}
      </mark>
    );
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
  onToggle: () => void;
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
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const [noteHeight, setNoteHeight] = useState<number | null>(null);

  function handleResizeDragStart(e: React.MouseEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = textareaRef.current?.offsetHeight ?? 96;
    function onMove(ev: MouseEvent) {
      setNoteHeight(Math.max(60, startHeight + (ev.clientY - startY)));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function handleResizeTouchStart(e: React.TouchEvent) {
    const startY = e.touches[0].clientY;
    const startHeight = textareaRef.current?.offsetHeight ?? 96;
    function onMove(ev: TouchEvent) {
      ev.preventDefault();
      setNoteHeight(Math.max(60, startHeight + (ev.touches[0].clientY - startY)));
    }
    function onEnd() {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    }
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
  }

  const upd = useUpdateRow();
  const add = useAddRow();
  const del = useDeleteRow();

  // Reset local fields each time the row opens.
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

    // New row path
    if (!row) {
      const hasContent = localGroup.trim() || localName.trim() || localNote.trim();
      if (!hasContent) { onToggle(); return; }
      setSaving(true);
      try {
        await add.mutateAsync({ group: localGroup, name: localName, note: localNote });
        onToggle();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
      return;
    }

    // Existing row path
    const changed =
      localGroup !== row.group ||
      localName  !== row.name  ||
      localNote  !== row.note;

    if (!changed) { onToggle(); return; }

    setSaving(true);
    try {
      await upd.mutateAsync({
        id: row.id,
        version: row.version,
        payload: { group: localGroup, name: localName, note: localNote },
      });
      onToggle();
      setSavedFlash(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      if (e instanceof ConflictError) setConflict(e.latest);
      else setError((e as Error).message);
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
    onToggle();
  }

  // ── Collapsed view ─────────────────────────────────────────────────────────

  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer group"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
            <HL text={row?.name || "(unnamed)"} query={query} />
          </div>
          {savedFlash && (
            <span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Saved ✓
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
          {row?.group && (
            <span className="shrink-0 rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-slate-600 dark:text-slate-300 font-medium">
              <HL text={row.group} query={query} />
            </span>
          )}
          {row?.group && row?.note && <span className="text-slate-300 dark:text-slate-600">·</span>}
          <span className="truncate">
            <HL text={row?.note || ""} query={query} />
          </span>
        </div>
      </button>
    );
  }

  // ── Expanded view ──────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-md dark:shadow-slate-900/50">

      {/* Header — left: collapse trigger · right: actions */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-700 rounded-t-lg">
        <button
          onClick={handleCollapse}
          disabled={saving}
          className="flex-1 flex items-center gap-2 px-3 py-2.5 text-left font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-50 rounded-tl-lg transition-colors min-w-0"
        >
          <span className="text-slate-400 dark:text-slate-500 text-xs shrink-0">▲</span>
          <span className="truncate">{row?.name || localName || "New note"}</span>
          {saving && (
            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">Saving…</span>
          )}
        </button>

        {/* Actions in header */}
        <div className="flex items-center gap-1 pr-2 shrink-0">
          {row && (
            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              className="rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-50 transition-colors"
            >
              {duplicating ? "Duplicating…" : "Duplicate"}
            </button>
          )}
          {!row && (
            <button
              onClick={onToggle}
              className="rounded border border-slate-200 dark:border-slate-600 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Discard
            </button>
          )}
          {row && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-2 py-1 text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
            >
              Delete
            </button>
          )}
          {row && confirmDelete && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Delete?</span>
              <button
                onClick={handleDelete}
                disabled={del.isPending}
                className="font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-slate-500 dark:text-slate-400 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pb-3 pt-3 space-y-3">

        {/* Group + Name on one row */}
        <div className="flex gap-3">
          <input
            aria-label="Group"
            placeholder="Group"
            value={localGroup}
            onChange={e => setLocalGroup(e.target.value)}
            className="w-28 shrink-0 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 transition-shadow"
          />
          <input
            aria-label="Name"
            placeholder="Name"
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            className="flex-1 min-w-0 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 transition-shadow"
          />
        </div>

        <div>
          <textarea
            ref={textareaRef}
            aria-label="Note"
            placeholder="Note"
            value={localNote}
            onChange={e => setLocalNote(e.target.value)}
            rows={4}
            style={noteHeight !== null ? { height: noteHeight } : undefined}
            className="w-full rounded-t-md rounded-b-none border border-b-0 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 transition-shadow"
          />
          <div
            onMouseDown={handleResizeDragStart}
            onTouchStart={handleResizeTouchStart}
            className="flex items-center justify-center h-5 cursor-ns-resize rounded-b-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 select-none"
          >
            <div className="w-2/3 h-1 rounded-full bg-slate-300 dark:bg-slate-500" />
          </div>
        </div>

        {/* Generic error */}
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Conflict banner */}
        {conflict && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm">
            <span className="font-medium text-amber-800 dark:text-amber-400">
              Someone else saved changes.
            </span>{" "}
            <button
              onClick={handleOverwrite}
              disabled={saving}
              className="underline text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:text-slate-900 dark:hover:text-slate-100"
            >
              Overwrite
            </button>
            {" · "}
            <button
              onClick={handleDiscardMine}
              disabled={saving}
              className="underline text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:text-slate-900 dark:hover:text-slate-100"
            >
              Discard mine
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
