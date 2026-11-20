import { describe, expect, it } from "vitest";
import { computeTotals, formatMoney, lineTotal, parseMoney, parsePercent } from "@/lib/money";
import { formatDocumentNumber } from "@/server/services/sequences";

const NBSP = String.fromCharCode(0xa0);

describe("money", () => {
  it("computes line totals without floating point drift", () => {
    expect(lineTotal({ quantity: "3", unitPrice: 1999 })).toBe(5997);
    expect(lineTotal({ quantity: "0,333", unitPrice: 30000 })).toBe(9990);
    expect(lineTotal({ quantity: 1.1, unitPrice: 10 })).toBe(11);
    expect(lineTotal({ quantity: "abc", unitPrice: 100 })).toBe(0);
  });

  it("applies discount then tax", () => {
    expect(computeTotals([{ quantity: 2, unitPrice: 50000 }, { quantity: 1, unitPrice: 25000 }], 5000, 1600)).toEqual({
      subtotal: 125000,
      discount: 5000,
      taxAmount: 19200,
      total: 139200,
    });
  });

  it("never discounts more than the subtotal", () => {
    expect(computeTotals([{ quantity: 1, unitPrice: 1000 }], 5000).total).toBe(0);
  });

  it("formats USD with cents and CDF without", () => {
    expect(formatMoney(125050, "USD", "en")).toBe("$1,250.50");
    expect(formatMoney(12500000, "CDF", "fr")).toBe(`125${NBSP}000${NBSP}CDF`);
    expect(formatMoney(125050, "USD", "fr")).toBe(`1${NBSP}250,50${NBSP}$US`);
  });

  it("parses amounts typed in French or English", () => {
    expect(parseMoney("1 250,50")).toBe(125050);
    expect(parseMoney("1,250.50")).toBe(125050);
    expect(parseMoney("450")).toBe(45000);
    expect(parseMoney("12.345")).toBeNull();
    expect(parseMoney("")).toBeNull();
    expect(parsePercent("16")).toBe(1600);
    expect(parsePercent("16,5 %")).toBe(1650);
    expect(parsePercent("150")).toBeNull();
  });

  it("formats document numbers", () => {
    expect(formatDocumentNumber("DEV", 2026, 7)).toBe("DEV-2026-0007");
  });
});
