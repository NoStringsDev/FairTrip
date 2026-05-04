import { db } from "../db/database";
import type { FxRateRow, QuoteCurrency } from "../types";
import {
  fetchGbpPerUnitForDate,
  fetchLatestGbpPerUnit,
  resolveGbpPerUnitForExpenseDate,
} from "../domain/fx";

function fxId(rateDate: string, quote: QuoteCurrency): string {
  return `${rateDate}|GBP|${quote}`;
}

export async function getCachedGbpPerUnit(
  rateDate: string,
  quote: QuoteCurrency
): Promise<FxRateRow | undefined> {
  return db.fxRates.get(fxId(rateDate, quote));
}

export async function cacheFxRow(row: Omit<FxRateRow, "id">): Promise<void> {
  const id = fxId(row.rateDate, row.quote);
  await db.fxRates.put({ ...row, id });
}

export async function resolveAndCacheGbpPerUnitForDate(
  expenseDate: Date,
  quote: QuoteCurrency
): Promise<{ gbpPerUnit: number; row: FxRateRow } | null> {
  const iso = expenseDate.toISOString().slice(0, 10);
  const cached = await getCachedGbpPerUnit(iso, quote);
  if (cached) {
    return { gbpPerUnit: cached.gbpPerUnit, row: cached };
  }
  const quoteResult = await resolveGbpPerUnitForExpenseDate(expenseDate, quote);
  if (!quoteResult) return null;
  const row: FxRateRow = {
    id: fxId(quoteResult.rateDate, quote),
    rateDate: quoteResult.rateDate,
    base: "GBP",
    quote,
    gbpPerUnit: quoteResult.gbpPerUnit,
    retrievalType: quoteResult.retrievalType,
    fetchedAt: Date.now(),
  };
  await cacheFxRow(row);
  return { gbpPerUnit: quoteResult.gbpPerUnit, row };
}
