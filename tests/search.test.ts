import { describe, it, expect } from "vitest";
import { filterRows } from "../src/lib/search";
import type { VaultRow } from "../src/lib/types";

const rows: VaultRow[] = [
  { id: "1", group: "Work", name: "Email", note: "alice@co.com pw123", version: 1, updatedAt: "" },
  { id: "2", group: "Personal", name: "Craigslist", note: "uzbtrkusa@gmail.com Finfree2022", version: 1, updatedAt: "" },
  { id: "3", group: "", name: "Stevens", note: "ababakha Stevensaziz1", version: 1, updatedAt: "" },
  { id: "4", group: "Travel", name: "Café Loyalty", note: "member 123", version: 1, updatedAt: "" },
];

describe("filterRows", () => {
  it("empty query returns all rows", () => {
    expect(filterRows(rows, "", "all")).toHaveLength(4);
  });

  it("single term substring match (case-insensitive)", () => {
    const r = filterRows(rows, "craig", "all");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("2");
  });

  it("multiple terms must all match (order-independent)", () => {
    const a = filterRows(rows, "craig gmail", "all");
    const b = filterRows(rows, "gmail craig", "all");
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
    expect(a[0].id).toBe("2");
  });

  it("returns empty when one term has no match", () => {
    expect(filterRows(rows, "craig xyz", "all")).toHaveLength(0);
  });

  it("scope narrows to a single field", () => {
    expect(filterRows(rows, "stevens", "name")).toHaveLength(1);
    // 'stevens' also appears in note of row 3, but scope=name still matches
    // because we scope the haystack; verify scope=group misses row 3
    expect(filterRows(rows, "stevens", "group")).toHaveLength(0);
  });

  it("diacritics-insensitive", () => {
    expect(filterRows(rows, "cafe", "all")).toHaveLength(1);
    expect(filterRows(rows, "café", "all")).toHaveLength(1);
  });
});
