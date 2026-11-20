/**
 * Money is stored as integer cents with a currency. USD and CDF amounts are
 * never added together. Tax rates are stored in basis points (1600 = 16 %).
 */
export type Currency = "USD" | "CDF";

export interface LineInput {
  quantity: string | number;
  unitPrice: number;
}

/** Quantity times unit price, rounded to the cent. Quantities may have 3 decimals. */
export function lineTotal({ quantity, unitPrice }: LineInput): number {
  const qty = typeof quantity === "number" ? quantity : Number(String(quantity).replace(",", "."));
  if (!Number.isFinite(qty)) return 0;
  // Integer arithmetic on thousandths avoids floating point drift.
  const thousandths = Math.round(qty * 1000);
  return Math.round((thousandths * unitPrice) / 1000);
}

export interface Totals {
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
}

export function computeTotals(lines: LineInput[], discount = 0, taxRateBasisPoints = 0): Totals {
  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const appliedDiscount = Math.min(Math.max(0, discount), subtotal);
  const taxable = subtotal - appliedDiscount;
  const taxAmount = Math.round((taxable * taxRateBasisPoints) / 10_000);
  return { subtotal, discount: appliedDiscount, taxAmount, total: taxable + taxAmount };
}

const FRACTION_DIGITS: Record<Currency, number> = { USD: 2, CDF: 0 };

/** 1250,50 $US or 125 000 FC, following the document language. */
export function formatMoney(cents: number, currency: Currency, locale: "fr" | "en" = "fr"): string {
  const digits = FRACTION_DIGITS[currency];
  const formatted = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency,
    currencyDisplay: currency === "CDF" ? "code" : "symbol",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
  // Narrow no-break spaces from Intl break PDF fonts: use regular no-break spaces.
  return formatted.replace(/\u{202F}/gu, "\u{A0}");
}

/** Parses "1 250,50", "1250.5" or "1,250.50" into cents. Returns null when invalid. */
export function parseMoney(input: string): number | null {
  let value = input.trim().replace(/[\s\u{A0}\u{202F}$]/gu, "").replace(/(USD|CDF|FC)$/i, "");
  if (!value) return null;
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma > lastDot) value = value.replace(/\./g, "").replace(",", ".");
  else value = value.replace(/,/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

/** "16" or "16,5" percent into basis points. */
export function parsePercent(input: string): number | null {
  const value = input.trim().replace(",", ".").replace("%", "");
  if (value === "") return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) return null;
  return Math.round(number * 100);
}
