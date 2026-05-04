import Dexie, { type Table } from "dexie";
import type { Expense, FxRateRow, Trip } from "../types";

export interface ReceiptBlob {
  id: string;
  dataUrl: string;
  createdAt: number;
}

export class FairTripDB extends Dexie {
  trips!: Table<Trip, string>;
  expenses!: Table<Expense, string>;
  fxRates!: Table<FxRateRow, string>;
  receipts!: Table<ReceiptBlob, string>;
  syncQueue!: Table<{ id: string; payload: string; createdAt: number }, string>;

  constructor() {
    super("FairTrip");
    this.version(1).stores({
      trips: "id, tripCode, updatedAt",
      expenses: "id, tripId, expenseTimestamp, updatedAt, deletedAt",
      fxRates: "id, rateDate, base",
      syncQueue: "id, createdAt",
    });
    this.version(2).stores({
      trips: "id, tripCode, updatedAt",
      expenses: "id, tripId, expenseTimestamp, updatedAt, deletedAt",
      fxRates: "id, rateDate, base",
      receipts: "id, createdAt",
      syncQueue: "id, createdAt",
    });
    this.version(3).stores({
      trips: "id, tripCode, updatedAt",
      expenses: "id, tripId, expenseTimestamp, updatedAt, deletedAt",
      fxRates: "id, rateDate, base",
      receipts: "id, createdAt",
      syncQueue: "id, createdAt",
    }).upgrade(async (tx) => {
      await tx.table("fxRates").clear();
    });
  }
}

export const db = new FairTripDB();
