import { useEffect, useRef } from "react";

export function SearchBar({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="relative">
      {/* Search icon */}
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      <input
        ref={ref}
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search (press /)…"
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-8 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 transition-shadow"
      />

      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-lg leading-none"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
