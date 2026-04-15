import type { VaultRow, VaultRowPlain } from "../lib/types";

export function ConflictModal(props: {
  theirs: VaultRow;
  mine: VaultRowPlain;
  onKeepTheirs: () => void;
  onKeepMine: () => void;
  onMerge: () => void;
}) {
  const { theirs, mine } = props;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-5 max-w-2xl w-full space-y-3">
        <h2 className="font-semibold">⚠ This row was changed elsewhere</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded border p-2">
            <div className="font-medium mb-1">Their version (v{theirs.version})</div>
            <div><span className="text-slate-500">Group:</span> {theirs.group}</div>
            <div><span className="text-slate-500">Name:</span> {theirs.name}</div>
            <div className="whitespace-pre-wrap"><span className="text-slate-500">Note:</span> {theirs.note}</div>
          </div>
          <div className="rounded border p-2">
            <div className="font-medium mb-1">Your version</div>
            <div><span className="text-slate-500">Group:</span> {mine.group}</div>
            <div><span className="text-slate-500">Name:</span> {mine.name}</div>
            <div className="whitespace-pre-wrap"><span className="text-slate-500">Note:</span> {mine.note}</div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={props.onKeepTheirs} className="rounded border px-3 py-1">Keep theirs</button>
          <button onClick={props.onMerge} className="rounded border px-3 py-1">Merge…</button>
          <button onClick={props.onKeepMine} className="rounded bg-slate-900 text-white px-3 py-1">Keep mine</button>
        </div>
      </div>
    </div>
  );
}
