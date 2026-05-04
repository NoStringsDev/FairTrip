import type { CurrencyCode } from "../types";

export function minorUnitsFor(currency: CurrencyCode): number {
  return currency === "JPY" ? 1 : 100;
}

export function parseAmountToMinor(
  input: string,
  currency: CurrencyCode
): number | null {
  const normalized = input.replace(/,/g, "").trim();
  if (!normalized) return null;
  const minor = minorUnitsFor(currency);
  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * minor);
}

export function formatMinor(
  minor: number,
  currency: CurrencyCode,
  locale = "en-GB"
): string {
  const minorDiv = minorUnitsFor(currency);
  const amount = minor / minorDiv;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(amount);
}
