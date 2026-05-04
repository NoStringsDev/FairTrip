import { db } from "../db/database";
import type { Expense, QuoteCurrency } from "../types";
import { convertExpenseMinorToGbpMinor } from "../domain/fx";
import { resolveAndCacheGbpPerUnitForDate } from "./fxCache";
import { fetchFxFromServer, syncEnabled } from "./sync";

function quoteFromExpenseCurrency(expense: Expense): QuoteCurrency | null {
  if (expense.currencyCode === "GBP") return null;
  return expense.currencyCode as QuoteCurrency;
}

export async function enrichExpenseWithFx(e: Expense): Promise<Expense> {
  if (e.manualGbpMinorUnits != null) {
    return {
      ...e,
      conversionMode: "manualOverride",
      convertedGbpMinorUnits: e.manualGbpMinorUnits,
    };
  }
  if (e.currencyCode === "GBP") {
    return {
      ...e,
      conversionMode: "auto",
      fxRateUsed: 1,
      fxRateDateUsed: new Date(e.expenseTimestamp).toISOString().slice(0, 10),
      fxRetrievalType: "historical",
      convertedGbpMinorUnits: e.amountMinorUnits,
    };
  }
  const quote = quoteFromExpenseCurrency(e);
  if (!quote) return e;

  const d = new Date(e.expenseTimestamp);
  if (syncEnabled()) {
    const iso = d.toISOString().slice(0, 10);
    const srv = await fetchFxFromServer(iso, quote);
    if (srv) {
      const gbpMinor = convertExpenseMinorToGbpMinor(
        e.amountMinorUnits,
        e.currencyCode,
        srv.gbpPerUnit
      );
      return {
        ...e,
        conversionMode: "auto",
        fxRateUsed: srv.gbpPerUnit,
        fxRateDateUsed: srv.rateDate,
        fxRetrievalType:
          srv.retrievalType === "currentFallback"
            ? "currentFallback"
            : "historical",
        convertedGbpMinorUnits: gbpMinor,
      };
    }
  }
  const resolved = await resolveAndCacheGbpPerUnitForDate(d, quote);
  if (!resolved) return e;
  const gbpMinor = convertExpenseMinorToGbpMinor(
    e.amountMinorUnits,
    e.currencyCode,
    resolved.gbpPerUnit
  );
  return {
    ...e,
    conversionMode: "auto",
    fxRateUsed: resolved.gbpPerUnit,
    fxRateDateUsed: resolved.row.rateDate,
    fxRetrievalType: resolved.row.retrievalType,
    convertedGbpMinorUnits: gbpMinor,
  };
}

export async function saveExpense(e: Expense): Promise<Expense> {
  const enriched = await enrichExpenseWithFx(e);
  await db.expenses.put(enriched);
  return enriched;
}
