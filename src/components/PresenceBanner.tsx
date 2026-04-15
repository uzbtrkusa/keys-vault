import { useState } from "react";
import type { PresenceEntry } from "../vault/usePresence";

export function PresenceBanner({ others }: { others: PresenceEntry[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const active = others.filter(o => !dismissed.has(o.presence_ref));
  if (active.length === 0) return null;
  const first = active[0];
  return (
    <div className="rounded bg-blue-50 border border-blue-200 p-2 text-sm flex items-center justify-between">
      <span>ℹ Also open on: {first.device_label}{active.length > 1 ? ` (+${active.length - 1} more)` : ""}</span>
      <button onClick={() => setDismissed(s => new Set([...s, ...active.map(a => a.presence_ref)]))} className="text-slate-500">×</button>
    </div>
  );
}
