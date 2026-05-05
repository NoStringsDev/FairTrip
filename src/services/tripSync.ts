import { db } from "../db/database";
import type { Expense } from "../types";
import { mergePullIntoLocal } from "../lib/mergeRemote";
import type { RemoteExpenseRow, RemoteTripRow } from "../lib/mergeRemote";
import { pullTrip, pushTripAndExpenses, syncEnabled } from "./sync";
import { normalizeTrip } from "../lib/tripNormalize";
import { normalizeExpense } from "../lib/expenseNormalize";

const inFlightByTrip = new Map<string, Promise<void>>();

async function withTripSyncLock(
  tripId: string,
  work: () => Promise<void>
): Promise<void> {
  const prev = inFlightByTrip.get(tripId) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(work);
  inFlightByTrip.set(tripId, next);
  try {
    await next;
  } finally {
    if (inFlightByTrip.get(tripId) === next) {
      inFlightByTrip.delete(tripId);
    }
  }
}

export async function pushLocalTrip(tripId: string): Promise<void> {
  if (!syncEnabled()) return;
  const beforeMerge = await db.trips.get(tripId);
  if (!beforeMerge) return;
  await pullAndMergeTrip(beforeMerge.tripCode);
  const raw = await db.trips.get(tripId);
  if (!raw) return;
  const trip = normalizeTrip(raw);
  const expenses = await db.expenses.where("tripId").equals(tripId).toArray();
  const normalized: Expense[] = expenses.map((e) => normalizeExpense(e, trip));
  await pushTripAndExpenses({ trip, expenses: normalized });
}

export async function pullAndMergeTrip(tripCode: string): Promise<boolean> {
  if (!syncEnabled()) return false;
  const data = (await pullTrip(tripCode)) as {
    trip: RemoteTripRow | null;
    expenses: RemoteExpenseRow[];
  } | null;
  if (!data?.trip) return false;
  await mergePullIntoLocal(data.trip, data.expenses ?? []);
  return true;
}

export async function schedulePush(tripId: string): Promise<void> {
  try {
    await withTripSyncLock(tripId, () => pushLocalTrip(tripId));
  } catch {
    await db.syncQueue.add({
      id: `${tripId}-${Date.now()}`,
      payload: tripId,
      createdAt: Date.now(),
    });
  }
}

export async function flushSyncQueue(): Promise<void> {
  if (!syncEnabled()) return;
  const items = await db.syncQueue.orderBy("createdAt").toArray();
  for (const q of items) {
    try {
      await withTripSyncLock(q.payload, () => pushLocalTrip(q.payload));
      await db.syncQueue.delete(q.id);
    } catch {
      break;
    }
  }
}
