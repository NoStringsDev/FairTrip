import { db } from "../db/database";
import type {
  CurrencyCode,
  Expense,
  LegacyAssignedTo,
  LegacyCoupleId,
  Trip,
  TripEntity,
} from "../types";
import {
  LEGACY_BARRIGAULTS_ID,
  LEGACY_HUNTERS_ID,
} from "./tripNormalize";

/** Row shape from D1 `/api/sync/pull` */
export interface RemoteTripRow {
  id: string;
  name: string;
  home_currency: string;
  trip_currency: string;
  settlement_currency: string;
  trip_code: string;
  created_at: number;
  closed_at: number | null;
  updated_at: number;
  entities_json?: string | null;
  supported_currencies_json?: string | null;
  participant_count?: number | null;
  trip_notes?: string | null;
}

export interface RemoteExpenseRow {
  id: string;
  trip_id: string;
  amount_minor: number;
  currency: string;
  payer_couple: string;
  assigned_to: string;
  note: string;
  category: string;
  expense_timestamp: number;
  receipt_r2_key: string | null;
  manual_gbp_minor: number | null;
  fx_rate_used: number | null;
  fx_rate_date_used: string | null;
  fx_retrieval_type: string | null;
  converted_gbp_minor: number | null;
  conversion_mode: string;
  deleted_at: number | null;
  updated_at: number;
}

function parseJson<T>(raw: string | null | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function mapRemoteTrip(r: RemoteTripRow): Trip {
  const entities = parseJson<TripEntity[]>(r.entities_json ?? undefined) ?? [];
  const supported =
    parseJson<CurrencyCode[]>(r.supported_currencies_json ?? undefined) ?? [];
  return {
    id: r.id,
    name: r.name,
    homeCurrency: r.home_currency as Trip["homeCurrency"],
    tripCurrency: r.trip_currency as Trip["tripCurrency"],
    settlementCurrency: r.settlement_currency as Trip["settlementCurrency"],
    tripCode: r.trip_code,
    createdAt: r.created_at,
    closedAt: r.closed_at ?? undefined,
    updatedAt: r.updated_at,
    entities,
    supportedCurrencies: supported,
    participantCount: r.participant_count ?? undefined,
    tripNotes: r.trip_notes ?? undefined,
  };
}

export function mapRemoteExpense(r: RemoteExpenseRow): Expense {
  const at = String(r.assigned_to);
  const shared = at === "Shared50_50" || at === "shared_equal";
  const pid = String(r.payer_couple);
  const legacyPayer: LegacyCoupleId | undefined =
    pid === "Hunters" || pid === "Barrigaults" ? pid : undefined;
  const legacyAssigned: LegacyAssignedTo | undefined = shared
    ? undefined
    : at === "Hunters" || at === "Barrigaults"
      ? (at as LegacyCoupleId)
      : undefined;

  const beneficiaryEntityId = shared
    ? undefined
    : at === "Hunters"
      ? LEGACY_HUNTERS_ID
      : at === "Barrigaults"
        ? LEGACY_BARRIGAULTS_ID
        : at;

  return {
    id: r.id,
    tripId: r.trip_id,
    amountMinorUnits: r.amount_minor,
    currencyCode: r.currency as Expense["currencyCode"],
    payerEntityId:
      pid === "Hunters"
        ? LEGACY_HUNTERS_ID
        : pid === "Barrigaults"
          ? LEGACY_BARRIGAULTS_ID
          : pid,
    splitMode: shared ? "shared_equal" : "single",
    beneficiaryEntityId,
    payerCouple: legacyPayer,
    assignedTo: legacyAssigned,
    note: r.note,
    category: r.category,
    expenseTimestamp: r.expense_timestamp,
    receiptR2Key: r.receipt_r2_key ?? undefined,
    manualGbpMinorUnits: r.manual_gbp_minor ?? undefined,
    fxRateUsed: r.fx_rate_used ?? undefined,
    fxRateDateUsed: r.fx_rate_date_used ?? undefined,
    fxRetrievalType: r.fx_retrieval_type as Expense["fxRetrievalType"],
    convertedGbpMinorUnits: r.converted_gbp_minor ?? undefined,
    conversionMode: r.conversion_mode as Expense["conversionMode"],
    deletedAt: r.deleted_at ?? undefined,
    updatedAt: r.updated_at,
  };
}

export async function mergePullIntoLocal(
  trip: RemoteTripRow,
  expenses: RemoteExpenseRow[]
): Promise<void> {
  const mappedTrip = mapRemoteTrip(trip);
  const localTrip = await db.trips.get(mappedTrip.id);
  if (!localTrip || mappedTrip.updatedAt >= localTrip.updatedAt) {
    await db.trips.put(mappedTrip);
  }
  for (const row of expenses) {
    const e = mapRemoteExpense(row);
    const local = await db.expenses.get(e.id);
    if (!local || e.updatedAt >= local.updatedAt) {
      await db.expenses.put(e);
    }
  }
}
