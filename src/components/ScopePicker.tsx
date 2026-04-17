import type { SearchScope } from "../lib/types";

export function ScopePicker({ value, onChange }: { value: SearchScope; onChange: (s: SearchScope) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as SearchScope)}
      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
    >
      <option value="all">All</option>
      <option value="group">Group</option>
      <option value="name">Name</option>
      <option value="note">Note</option>
    </select>
  );
}
