import type { VaultRow, SearchScope } from "./types";

/** Lowercase + NFKD + strip diacritics. */
function normalize(s: string): string {
  return s.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function haystack(row: VaultRow, scope: SearchScope): string {
  switch (scope) {
    case "group": return normalize(row.group);
    case "name": return normalize(row.name);
    case "note": return normalize(row.note);
    case "all": return normalize(`${row.group} ${row.name} ${row.note}`);
  }
}

export function filterRows(
  rows: VaultRow[],
  query: string,
  scope: SearchScope
): VaultRow[] {
  const terms = query.trim().split(/\s+/).filter(Boolean).map(normalize);
  if (terms.length === 0) return rows;
  return rows.filter(row => {
    const h = haystack(row, scope);
    return terms.every(t => h.includes(t));
  });
}

/** Given a matched row and query, return an array of [index, length] spans
 *  to highlight within the given field's string. Used by the UI <mark>. */
export function highlightSpans(
  field: string,
  query: string
): Array<[number, number]> {
  const norm = normalize(field);
  const terms = query.trim().split(/\s+/).filter(Boolean).map(normalize);
  const spans: Array<[number, number]> = [];
  for (const t of terms) {
    let idx = 0;
    while ((idx = norm.indexOf(t, idx)) !== -1) {
      spans.push([idx, t.length]);
      idx += t.length;
    }
  }
  // merge overlapping
  spans.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [s, l] of spans) {
    const last = merged[merged.length - 1];
    if (last && s <= last[0] + last[1]) {
      last[1] = Math.max(last[1], s + l - last[0]);
    } else {
      merged.push([s, l]);
    }
  }
  return merged;
}
