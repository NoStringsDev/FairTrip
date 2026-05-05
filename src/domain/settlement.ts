import type { CurrencyCode, Expense, Trip } from "../types";
import { convertExpenseMinorToGbpMinor } from "./fx";
import { minorUnitsFor } from "./currency";
import { normalizeExpense } from "../lib/expenseNormalize";
import { normalizeTrip } from "../lib/tripNormalize";

export interface EffectiveExpenseGbp {
  expenseId: string;
  gbpMinor: number;
  mode: "manual" | "auto";
  fxRateUsed?: number;
  fxRateDateUsed?: string;
  fxRetrievalType?: import("../types").FxRetrievalType;
}

export interface EntityNet {
  entityId: string;
  /** Positive = should receive money overall after pooling. */
  netGbpMinor: number;
}

export interface SettlementTransfer {
  fromEntityId: string;
  toEntityId: string;
  amountGbpMinor: number;
}

export interface SettlementResult {
  settled: boolean;
  nets: EntityNet[];
  transfers: SettlementTransfer[];
}

function splitSharesMinor(
  totalMinor: number,
  n: number
): number[] {
  if (n <= 0) return [];
  const base = Math.floor(totalMinor / n);
  let rem = totalMinor - base * n;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let v = base;
    if (rem > 0) {
      v += 1;
      rem -= 1;
    }
    out.push(v);
  }
  return out;
}

/**
 * Updates per-entity nets: positive = should receive from the group overall.
 */
export function applyExpenseToNets(
  nets: Map<string, number>,
  trip: Trip,
  e: Expense,
  eff: EffectiveExpenseGbp
): void {
  const t = normalizeTrip(trip);
  const ex = normalizeExpense(e, trip);
  const ids = t.entities.map((x) => x.id);
  const N = ids.length;
  if (N === 0) return;
  const T = eff.gbpMinor;
  const P = ex.payerEntityId;

  if (ex.splitMode === "shared_equal") {
    const shares = splitSharesMinor(T, N);
    for (let i = 0; i < N; i++) {
      const id = ids[i];
      const cur = nets.get(id) ?? 0;
      if (id === P) nets.set(id, cur + T - shares[i]);
      else nets.set(id, cur - shares[i]);
    }
    return;
  }

  const B = ex.beneficiaryEntityId;
  if (!B) return;
  if (P === B) return;
  nets.set(P, (nets.get(P) ?? 0) + T);
  nets.set(B, (nets.get(B) ?? 0) - T);
}

export function simplifyTransfers(nets: Map<string, number>): SettlementTransfer[] {
  const creditors: { id: string; v: number }[] = [];
  const debtors: { id: string; v: number }[] = [];
  for (const [id, v] of nets) {
    if (v > 0) creditors.push({ id, v });
    else if (v < 0) debtors.push({ id, v: -v });
  }
  creditors.sort((a, b) => b.v - a.v);
  debtors.sort((a, b) => b.v - a.v);
  const transfers: SettlementTransfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const amt = Math.min(c.v, d.v);
    if (amt > 0) {
      transfers.push({
        fromEntityId: d.id,
        toEntityId: c.id,
        amountGbpMinor: amt,
      });
    }
    c.v -= amt;
    d.v -= amt;
    if (c.v < 1) ci++;
    if (d.v < 1) di++;
  }
  return transfers;
}

export function computeSettlement(
  trip: Trip,
  expenses: Expense[],
  getEffectiveGbp: (e: Expense) => EffectiveExpenseGbp | null
): SettlementResult {
  const t = normalizeTrip(trip);
  const nets = new Map<string, number>();
  for (const ent of t.entities) nets.set(ent.id, 0);

  for (const e of expenses) {
    if (e.deletedAt) continue;
    const eff = getEffectiveGbp(e);
    if (!eff) continue;
    applyExpenseToNets(nets, trip, e, eff);
  }

  const netArr: EntityNet[] = t.entities.map((ent) => ({
    entityId: ent.id,
    netGbpMinor: nets.get(ent.id) ?? 0,
  }));

  const transfers = simplifyTransfers(new Map(nets));
  const settled = transfers.length === 0;
  return { settled, nets: netArr, transfers };
}

export function buildEffectiveGbp(
  e: Expense,
  gbpPerUnit: number | undefined
): EffectiveExpenseGbp | null {
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
      fxRateDateUsed: undefined,
      fxRetrievalType: "historical",
    };
  }
  if (gbpPerUnit == null || !Number.isFinite(gbpPerUnit)) return null;
  const gbpMinor = convertExpenseMinorToGbpMinor(
    e.amountMinorUnits,
    e.currencyCode as CurrencyCode,
    gbpPerUnit
  );
  return {
    expenseId: e.id,
    gbpMinor,
    mode: "auto",
    fxRateUsed: gbpPerUnit,
    fxRateDateUsed: e.fxRateDateUsed,
    fxRetrievalType: e.fxRetrievalType,
  };
}

export function expenseDisplayOriginal(e: Expense): string {
  const div = minorUnitsFor(e.currencyCode);
  return (e.amountMinorUnits / div).toFixed(div === 1 ? 0 : 2);
}
