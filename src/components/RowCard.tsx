import { useNavigate } from "react-router-dom";
import type { VaultRow } from "../lib/types";
import { highlightSpans } from "../lib/search";

function HL({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const spans = highlightSpans(text, query);
  if (spans.length === 0) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach(([s, l], i) => {
    if (cursor < s) out.push(<span key={`t${i}`}>{text.slice(cursor, s)}</span>);
    out.push(<mark key={`m${i}`} className="bg-yellow-200 rounded px-0.5">{text.slice(s, s + l)}</mark>);
    cursor = s + l;
  });
  if (cursor < text.length) out.push(<span key="tail">{text.slice(cursor)}</span>);
  return <>{out}</>;
}

export function RowCard({ row, query }: { row: VaultRow; query: string }) {
  const nav = useNavigate();
  return (
    <div
      onClick={() => nav(`/edit/${row.id}`)}
      className="rounded border bg-white p-3 hover:bg-slate-50 cursor-pointer"
    >
      <div className="font-medium"><HL text={row.name || "(unnamed)"} query={query} /></div>
      <div className="text-xs text-slate-500">Group: <HL text={row.group || "(none)"} query={query} /></div>
      <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">
        <HL text={row.note} query={query} />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); copyToClipboard(row.note); }}
          className="rounded bg-slate-100 px-2 py-1 text-xs"
        >Copy note</button>
      </div>
    </div>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 30_000);
}
