import { describe, it, expect } from "vitest";
import { parseXlsxBuffer } from "../src/io/xlsx";
import * as XLSX from "xlsx";

function makeSheet(rows: (string | null)[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Main");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

describe("parseXlsxBuffer", () => {
  it("parses Group/Name/Note header rows", () => {
    const buf = makeSheet([
      [null, null, null],
      ["Group", "Name", "Note"],
      [null, "Craigslist", "foo@bar.com pw"],
      ["Work", "Email", "user@co.com secret"],
    ]);
    const rows = parseXlsxBuffer(buf);
    expect(rows).toEqual([
      { group: "", name: "Craigslist", note: "foo@bar.com pw" },
      { group: "Work", name: "Email", note: "user@co.com secret" },
    ]);
  });

  it("skips fully-empty rows", () => {
    const buf = makeSheet([
      ["Group", "Name", "Note"],
      [null, null, null],
      [null, "x", null],
    ]);
    const rows = parseXlsxBuffer(buf);
    expect(rows).toEqual([{ group: "", name: "x", note: "" }]);
  });
});
