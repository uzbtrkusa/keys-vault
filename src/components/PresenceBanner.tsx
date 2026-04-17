import { useState } from "react";
import type { PresenceEntry } from "../vault/usePresence";

export function PresenceBanner({ others }: { others: PresenceEntry[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const active = others.filter(o => !dismissed.has(o.presence_ref));
  if (active.length === 0) return null;
  const first = active[0];
  return (
    <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-3 py-2 text-sm text-blue-800 dark:text-blue-300 flex items-center justify-between">
      <span>
        Also open on: <span className="font-medium">{first.device_label}</span>
        {active.length > 1 ? ` (+${active.length - 1} more)` : ""}
      </span>
      <button
        onClick={() => setDismissed(s => new Set([...s, ...active.map(a => a.presence_ref)]))}
        className="ml-3 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 text-lg leading-none transition-colors"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
