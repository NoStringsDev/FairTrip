import type { Expense, Trip } from "../types";
import { normalizeExpense } from "./expenseNormalize";
import { entityById } from "./tripNormalize";

export function splitSummary(trip: Trip, e: Expense): string {
  const ex = normalizeExpense(e, trip);
  if (ex.splitMode === "shared_equal") return "Everyone";
  const b = ex.beneficiaryEntityId;
  if (!b) return "—";
  return entityById(trip, b)?.name ?? "Unknown";
}
