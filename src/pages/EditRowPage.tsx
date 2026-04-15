import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAddRow, useUpdateRow, useDeleteRow, ConflictError } from "../vault/useVaultMutations";
import { useSession } from "../session/SessionContext";
import type { VaultRow, VaultRowPlain } from "../lib/types";
import { ConflictModal } from "../components/ConflictModal";

export default function EditRowPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { rows } = useSession();
  const isNew = id === "new";
  const existing: VaultRow | undefined = isNew ? undefined : rows?.find(r => r.id === id);

  const [group, setGroup] = useState(existing?.group ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [conflict, setConflict] = useState<VaultRow | null>(null);

  const add = useAddRow();
  const upd = useUpdateRow();
  const del = useDeleteRow();

  useEffect(() => {
    if (!isNew && !existing) {
      // Row not found in cache — go back.
      nav("/");
    }
  }, [isNew, existing, nav]);

  async function onSave() {
    const payload: VaultRowPlain = { group, name, note };
    try {
      if (isNew) {
        await add.mutateAsync(payload);
      } else {
        await upd.mutateAsync({ id: existing!.id, version: existing!.version, payload });
      }
      nav("/");
    } catch (e) {
      if (e instanceof ConflictError) setConflict(e.latest);
      else alert((e as Error).message);
    }
  }

  async function onDelete() {
    if (!existing) return;
    if (!confirm("Delete this row?")) return;
    try {
      await del.mutateAsync({ id: existing.id, version: existing.version });
      nav("/");
    } catch (e) { alert((e as Error).message); }
  }

  return (
    <div className="mx-auto max-w-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => nav("/")} className="text-sm underline">← Back</button>
        <button onClick={onSave} disabled={add.isPending || upd.isPending}
          className="rounded bg-slate-900 text-white px-4 py-1 disabled:opacity-50">
          {add.isPending || upd.isPending ? "Saving…" : "Save"}
        </button>
      </div>
      <label className="block">
        <span className="text-sm">Group</span>
        <input value={group} onChange={e => setGroup(e.target.value)}
          className="w-full rounded border border-slate-300 p-2" />
      </label>
      <label className="block">
        <span className="text-sm">Name</span>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full rounded border border-slate-300 p-2" />
      </label>
      <label className="block">
        <span className="text-sm">Note</span>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={8}
          className="w-full rounded border border-slate-300 p-2 font-mono text-sm" />
      </label>
      {!isNew && (
        <button onClick={onDelete} className="text-sm text-red-700 underline">Delete row</button>
      )}
      {conflict && (
        <ConflictModal
          theirs={conflict}
          mine={{ group, name, note }}
          onKeepTheirs={() => { setGroup(conflict.group); setName(conflict.name); setNote(conflict.note); setConflict(null); }}
          onKeepMine={async () => {
            // Force save against the new version by bumping base version to theirs.
            try {
              await upd.mutateAsync({ id: conflict.id, version: conflict.version, payload: { group, name, note } });
              nav("/");
            } catch (e) { alert((e as Error).message); }
          }}
          onMerge={() => setConflict(null)}
        />
      )}
    </div>
  );
}
