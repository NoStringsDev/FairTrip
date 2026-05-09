import { db } from "../db/database";
import type { Expense } from "../types";
import { mergePullIntoLocal } from "../lib/mergeRemote";
import type { RemoteExpenseRow, RemoteTripRow } from "../lib/mergeRemote";
import { pullTripFetch, pushTripAndExpenses, syncEnabled } from "./sync";
import { normalizeTrip } from "../lib/tripNormalize";
import { normalizeExpense } from "../lib/expenseNormalize";

export type PullMergeResult =
  | { ok: true }
  | {
      ok: false;
      reason: "sync_disabled" | "network" | "http" | "no_trip_on_server";
      status?: number;
    };

export function formatPullMergeError(r: Extract<PullMergeResult, { ok: false }>): string {
  switch (r.reason) {
    case "sync_disabled":
      return "Sync is off (no API URL).";
    case "network":
      return "Could not reach server. Check connection.";
    case "http":
      return r.status != null
        ? `Server error (${r.status}). Try again.`
        : "Server error. Try again.";
    case "no_trip_on_server":
      return "Trip not found on server (check trip code).";
    default:
      return "Sync failed.";
  }
}

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
  await pullAndMergeTrip(beforeMerge.tripCode); // best-effort merge before push
  const raw = await db.trips.get(tripId);
  if (!raw) return;
  const trip = normalizeTrip(raw);
  const expenses = await db.expenses.where("tripId").equals(tripId).toArray();
  const normalized: Expense[] = expenses.map((e) => normalizeExpense(e, trip));
  await pushTripAndExpenses({ trip, expenses: normalized });
}

export async function pullAndMergeTrip(tripCode: string): Promise<PullMergeResult> {
  if (!syncEnabled()) return { ok: false, reason: "sync_disabled" };

  const fetched = await pullTripFetch(tripCode);
  if (!fetched.ok) {
    if (fetched.reason === "disabled") {
      return { ok: false, reason: "sync_disabled" };
    }
    if (fetched.reason === "network") {
      return { ok: false, reason: "network" };
    }
    return { ok: false, reason: "http", status: fetched.status };
  }

  const data = fetched.data as {
    trip: RemoteTripRow | null;
    expenses: RemoteExpenseRow[];
  };
  if (!data?.trip) {
    return { ok: false, reason: "no_trip_on_server" };
  }
  await mergePullIntoLocal(data.trip, data.expenses ?? []);
  return { ok: true };
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
