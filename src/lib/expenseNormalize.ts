import type { Expense, Trip } from "../types";
import { LEGACY_BARRIGAULTS_ID, LEGACY_HUNTERS_ID, normalizeTrip } from "./tripNormalize";

/**
 * Canonical expense shape for UI + settlement. Migrates legacy `payerCouple` / `assignedTo`.
 */
export function normalizeExpense(expense: Expense, trip: Trip): Expense {
  const t = normalizeTrip(trip);
  const entityIds = new Set(t.entities.map((e) => e.id));

  if (expense.payerEntityId && entityIds.has(expense.payerEntityId)) {
    const sm = expense.splitMode ?? "shared_equal";
    return {
      ...expense,
      splitMode: sm,
      beneficiaryEntityId:
        sm === "single" ? expense.beneficiaryEntityId : undefined,
    };
  }

  const legacyPayer = expense.payerCouple;
  const payerEntityId =
    legacyPayer === "Hunters"
      ? LEGACY_HUNTERS_ID
      : legacyPayer === "Barrigaults"
        ? LEGACY_BARRIGAULTS_ID
        : t.entities[0]?.id ?? LEGACY_HUNTERS_ID;

  const assigned = expense.assignedTo;
  let splitMode = expense.splitMode ?? "shared_equal";
  let beneficiaryEntityId = expense.beneficiaryEntityId;

  if (!expense.splitMode && assigned) {
    if (assigned === "Shared50_50") {
      splitMode = "shared_equal";
      beneficiaryEntityId = undefined;
    } else {
      splitMode = "single";
      beneficiaryEntityId =
        assigned === "Hunters"
          ? LEGACY_HUNTERS_ID
          : assigned === "Barrigaults"
            ? LEGACY_BARRIGAULTS_ID
            : beneficiaryEntityId;
    }
  }

  return {
    ...expense,
    payerEntityId,
    splitMode,
    beneficiaryEntityId,
  };
}
