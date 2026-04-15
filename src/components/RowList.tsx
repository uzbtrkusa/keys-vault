import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import type { VaultRow } from "../lib/types";
import { RowCard } from "./RowCard";

export function RowList({ rows, query }: { rows: VaultRow[]; query: string }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 8,
  });
  return (
    <div ref={parentRef} className="h-[70vh] overflow-auto">
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map(vi => (
          <div
            key={vi.key}
            ref={v.measureElement}
            data-index={vi.index}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }}
            className="p-1"
          >
            <RowCard row={rows[vi.index]} query={query} />
          </div>
        ))}
      </div>
    </div>
  );
}
