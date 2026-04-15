import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { VaultRow } from "../lib/types";
import { RowCard } from "./RowCard";

export function RowList({ rows, query }: { rows: VaultRow[]; query: string }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  const nav = useNavigate();
  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 8,
  });

  useEffect(() => { setSelected(0); }, [query, rows.length]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        if (e.key === "Escape") (document.activeElement as HTMLElement).blur();
        return;
      }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, rows.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && rows[selected]) { e.preventDefault(); nav(`/edit/${rows[selected].id}`); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && rows[selected]) {
        navigator.clipboard.writeText(rows[selected].note);
        setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 30_000);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [rows, selected, nav]);

  useEffect(() => { v.scrollToIndex(selected, { align: "auto" }); }, [selected, v]);

  return (
    <div ref={parentRef} className="h-[70vh] overflow-auto">
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map(vi => (
          <div key={vi.key} ref={v.measureElement} data-index={vi.index}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }}
            className="p-1">
            <div className={vi.index === selected ? "ring-2 ring-slate-900 rounded" : ""}>
              <RowCard row={rows[vi.index]} query={query} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
