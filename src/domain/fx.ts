import type { CurrencyCode, FxRetrievalType, QuoteCurrency } from "../types";
import { minorUnitsFor } from "./currency";

export interface FxQuote {
  /** GBP per 1 major unit of the quote currency (e.g. per 1 JPY, per 1 EUR). */
  gbpPerUnit: number;
  rateDate: string;
  retrievalType: FxRetrievalType;
}

const FRANKFURTER = "https://api.frankfurter.app";
const TEST_FX_FALLBACK_GBP_PER_UNIT: Partial<Record<QuoteCurrency, number>> = {
  JPY: 0.0052,
  EUR: 0.86,
  USD: 0.75,
};

function forcedTestFxEnabled(): boolean {
  return import.meta.env.VITE_FORCE_TEST_FX === "1";
}

function fallbackGbpPerUnit(quote: QuoteCurrency): number {
  return TEST_FX_FALLBACK_GBP_PER_UNIT[quote] ?? 0.75;
}

async function fetchRates(
  path: string
): Promise<{ date?: string; rates?: Partial<Record<QuoteCurrency, number>> } | null> {
  try {
    const res = await fetch(`${FRANKFURTER}${path}`);
    if (!res.ok) return null;
    return (await res.json()) as {
      date?: string;
      rates?: Partial<Record<QuoteCurrency, number>>;
    };
  } catch {
    return null;
  }
}

/** `rates[quote]` = quote currency per 1 GBP → GBP per 1 quote unit = 1 / rates[quote]. */
function toGbpPerUnit(
  rates: Partial<Record<QuoteCurrency, number>> | undefined,
  quote: QuoteCurrency
): number | null {
  const perGbp = rates?.[quote];
  if (!perGbp || perGbp <= 0) return null;
  return 1 / perGbp;
}

export async function fetchGbpPerUnitForDate(
  isoDate: string,
  quote: QuoteCurrency
): Promise<FxQuote | null> {
  const data = await fetchRates(`/${isoDate}?from=GBP&to=${quote}`);
  const gbpPerUnit = toGbpPerUnit(data?.rates, quote);
  if (!gbpPerUnit) return null;
  return { gbpPerUnit, rateDate: isoDate, retrievalType: "historical" };
}

export async function fetchLatestGbpPerUnit(
  quote: QuoteCurrency
): Promise<FxQuote | null> {
  const data = await fetchRates(`/latest?from=GBP&to=${quote}`);
  const gbpPerUnit = toGbpPerUnit(data?.rates, quote);
  if (!gbpPerUnit) return null;
  const rateDate = data?.date ?? new Date().toISOString().slice(0, 10);
  return { gbpPerUnit, rateDate, retrievalType: "currentFallback" };
}

export async function resolveGbpPerUnitForExpenseDate(
  expenseDate: Date,
  quote: QuoteCurrency
): Promise<FxQuote | null> {
  const iso = expenseDate.toISOString().slice(0, 10);
  if (forcedTestFxEnabled()) {
    return {
      gbpPerUnit: fallbackGbpPerUnit(quote),
      rateDate: iso,
      retrievalType: "currentFallback",
    };
  }
  const historical = await fetchGbpPerUnitForDate(iso, quote);
  if (historical) return historical;
  const latest = await fetchLatestGbpPerUnit(quote);
  if (latest) return latest;
  // Last-resort fallback keeps local demos usable when offline.
  return {
    gbpPerUnit: fallbackGbpPerUnit(quote),
    rateDate: iso,
    retrievalType: "currentFallback",
  };
}

export function convertExpenseMinorToGbpMinor(
  amountMinor: number,
  currency: CurrencyCode,
  gbpPerUnit: number
): number {
  if (currency === "GBP") return amountMinor;
  const major = amountMinor / minorUnitsFor(currency);
  const gbpMajor = major * gbpPerUnit;
  return Math.round(gbpMajor * minorUnitsFor("GBP"));
}
