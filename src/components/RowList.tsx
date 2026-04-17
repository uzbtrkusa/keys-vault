import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import type { VaultRow } from "../lib/types";
import { RowItem } from "../vault/RowItem";

interface RowListProps {
  rows: VaultRow[];
  query: string;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  showNewRow: boolean;
  onDiscardNew: () => void;
  onDuplicateSaved: (newId: string) => void;
}

export function RowList({
  rows,
  query,
  expandedIds,
  onToggle,
  showNewRow,
  onDiscardNew,
  onDuplicateSaved,
}: RowListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);

  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 8,
  });

  // Reset selection when query or result count changes.
  useEffect(() => { setSelected(0); }, [query, rows.length]);

  // Keyboard navigation.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // While typing in a field, only handle Escape.
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        if (e.key === "Escape") (document.activeElement as HTMLElement).blur();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected(s => Math.min(s + 1, rows.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(s => Math.max(s - 1, 0));
      }
      // Enter now toggles expand/collapse instead of navigating.
      if (e.key === "Enter" && rows[selected]) {
        e.preventDefault();
        onToggle(rows[selected].id);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [rows, selected, onToggle]);

  // Keep selected row in view.
  useEffect(() => { v.scrollToIndex(selected, { align: "auto" }); }, [selected, v]);

  return (
    <div>
      {/* New-row card rendered above the virtualized list */}
      {showNewRow && (
        <div className="mb-2">
          <RowItem
            row={null}
            isExpanded={true}
            onToggle={onDiscardNew}
            onDuplicateSaved={onDuplicateSaved}
            query={query}
          />
        </div>
      )}

      {/* Virtualized list */}
      <div ref={parentRef} className="h-[70vh] overflow-auto">
        <div style={{ height: v.getTotalSize(), position: "relative" }}>
          {v.getVirtualItems().map(vi => (
            <div
              key={vi.key}
              ref={v.measureElement}
              data-index={vi.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vi.start}px)`,
              }}
              className="p-1"
            >
              <div className={vi.index === selected ? "ring-2 ring-slate-900 rounded" : ""}>
                <RowItem
                  row={rows[vi.index]}
                  isExpanded={expandedIds.has(rows[vi.index].id)}
                  onToggle={() => onToggle(rows[vi.index].id)}
                  onDuplicateSaved={onDuplicateSaved}
                  query={query}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
