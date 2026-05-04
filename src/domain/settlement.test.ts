import { describe, expect, it } from "vitest";
import type { Expense, Trip } from "../types";
import {
  applyExpenseToNets,
  computeSettlement,
  type EffectiveExpenseGbp,
} from "./settlement";
import { normalizeTrip } from "../lib/tripNormalize";

function tripTwo(aId: string, bId: string): Trip {
  return normalizeTrip({
    id: "t1",
    name: "Test",
    supportedCurrencies: ["GBP", "JPY"],
    homeCurrency: "GBP",
    tripCurrency: "JPY",
    settlementCurrency: "GBP",
    tripCode: "TESTCODE",
    entities: [
      { id: aId, name: "A", kind: "couple", colorIndex: 0 },
      { id: bId, name: "B", kind: "couple", colorIndex: 1 },
    ],
    createdAt: 1,
    updatedAt: 1,
  });
}

const eff = (gbpMinor: number): EffectiveExpenseGbp => ({
  expenseId: "x",
  gbpMinor,
  mode: "auto",
});

describe("applyExpenseToNets", () => {
  it("splits shared equally between two", () => {
    const t = tripTwo("a", "b");
    const nets = new Map<string, number>([
      ["a", 0],
      ["b", 0],
    ]);
    const e: Expense = {
      id: "1",
      tripId: t.id,
      amountMinorUnits: 100,
      currencyCode: "GBP",
      payerEntityId: "a",
      splitMode: "shared_equal",
      note: "",
      category: "",
      expenseTimestamp: 1,
      updatedAt: 1,
      conversionMode: "auto",
    };
    applyExpenseToNets(nets, t, e, eff(100));
    expect(nets.get("a")).toBe(50);
    expect(nets.get("b")).toBe(-50);
  });
});

describe("computeSettlement", () => {
  it("settles opposing single-beneficiary expenses", () => {
    const t = tripTwo("a", "b");
    const expenses: Expense[] = [
      {
        id: "1",
        tripId: t.id,
        amountMinorUnits: 1000,
        currencyCode: "GBP",
        payerEntityId: "a",
        splitMode: "single",
        beneficiaryEntityId: "b",
        note: "",
        category: "",
        expenseTimestamp: 1,
        updatedAt: 1,
        conversionMode: "auto",
      },
      {
        id: "2",
        tripId: t.id,
        amountMinorUnits: 1000,
        currencyCode: "GBP",
        payerEntityId: "b",
        splitMode: "single",
        beneficiaryEntityId: "a",
        note: "",
        category: "",
        expenseTimestamp: 2,
        updatedAt: 1,
        conversionMode: "auto",
      },
    ];
    const r = computeSettlement(t, expenses, () => ({
      expenseId: "",
      gbpMinor: 1000,
      mode: "auto",
    }));
    expect(r.settled).toBe(true);
    expect(r.transfers.length).toBe(0);
  });
});
