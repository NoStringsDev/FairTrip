import type { Expense } from "../types";
import type { EffectiveExpenseGbp } from "./settlement";

export function effectiveGbpFromExpense(e: Expense): EffectiveExpenseGbp | null {
  if (e.deletedAt) return null;
  if (e.manualGbpMinorUnits != null) {
    return {
      expenseId: e.id,
      gbpMinor: e.manualGbpMinorUnits,
      mode: "manual",
    };
  }
  if (e.currencyCode === "GBP") {
    return {
      expenseId: e.id,
      gbpMinor: e.amountMinorUnits,
      mode: "auto",
      fxRateUsed: 1,
      fxRateDateUsed: new Date(e.expenseTimestamp).toISOString().slice(0, 10),
      fxRetrievalType: "historical",
    };
  }
  if (e.convertedGbpMinorUnits != null) {
    return {
      expenseId: e.id,
      gbpMinor: e.convertedGbpMinorUnits,
      mode: "auto",
      fxRateUsed: e.fxRateUsed,
      fxRateDateUsed: e.fxRateDateUsed,
      fxRetrievalType: e.fxRetrievalType,
    };
  }
  return null;
}
