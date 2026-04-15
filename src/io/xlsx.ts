import * as XLSX from "xlsx";
import type { VaultRow, VaultRowPlain } from "../lib/types";

export function parseXlsxBuffer(buf: ArrayBuffer): VaultRowPlain[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames.includes("Main") ? "Main" : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: null });

  // Find header row containing 'Group','Name','Note' (case-insensitive).
  let headerIdx = -1;
  for (let i = 0; i < aoa.length; i++) {
    const row = aoa[i].map(c => String(c ?? "").toLowerCase().trim());
    if (row.includes("group") && row.includes("name") && row.includes("note")) {
      headerIdx = i; break;
    }
  }
  if (headerIdx === -1) throw new Error("Could not find a 'Group/Name/Note' header row.");

  const header = aoa[headerIdx].map(c => String(c ?? "").toLowerCase().trim());
  const idx = {
    group: header.indexOf("group"),
    name: header.indexOf("name"),
    note: header.indexOf("note"),
  };

  const out: VaultRowPlain[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const r = aoa[i];
    const group = String(r[idx.group] ?? "").trim();
    const name = String(r[idx.name] ?? "").trim();
    const note = String(r[idx.note] ?? "").trim();
    if (!group && !name && !note) continue;
    out.push({ group, name, note });
  }
  return out;
}

export function exportDecryptedXlsx(rows: VaultRow[]): ArrayBuffer {
  const aoa: (string)[][] = [["Group", "Name", "Note"]];
  for (const r of rows) aoa.push([r.group, r.name, r.note]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Main");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
