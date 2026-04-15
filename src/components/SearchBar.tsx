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
      <input
        ref={ref}
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search (press /)…"
        className="w-full rounded border border-slate-300 p-2 pr-8"
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">×</button>
      )}
    </div>
  );
}
