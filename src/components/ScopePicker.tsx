import type { SearchScope } from "../lib/types";

export function ScopePicker({ value, onChange }: { value: SearchScope; onChange: (s: SearchScope) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as SearchScope)}
      className="rounded border border-slate-300 p-1 text-sm"
    >
      <option value="all">All</option>
      <option value="group">Group</option>
      <option value="name">Name</option>
      <option value="note">Note</option>
    </select>
  );
}
