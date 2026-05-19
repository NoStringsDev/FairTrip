import { describe, expect, it } from "vitest";
import { extractReceiptTotalMinorUnits } from "./ocr";

describe("extractReceiptTotalMinorUnits", () => {
  it("prefers footer total over header phone (GBP)", () => {
    const text = `
Joe's Cafe
Tel: 020 7946 0958
London

Burger    8.50
TOTAL     12.75
`.trim();
    expect(extractReceiptTotalMinorUnits(text, "GBP")).toBe(1275);
  });

  it("rejects long JPY digit runs (e.g. mobile) in favour of labelled total", () => {
    const text = `
Store
Tel 09012345678
item 1000
合計 2480
`.trim();
    expect(extractReceiptTotalMinorUnits(text, "JPY")).toBe(2480);
  });

  it("uses last lines when there is no Tel keyword but a small total at bottom", () => {
    const text = `
Corner Shop
2.50
1.25
3.75
`.trim();
    expect(extractReceiptTotalMinorUnits(text, "GBP")).toBe(375);
  });

  it("does not treat contact-only block as amounts", () => {
    const text = "Tel: 020 1234 5678\nFax 020 8765 4321";
    expect(extractReceiptTotalMinorUnits(text, "GBP")).toBeNull();
  });
});
