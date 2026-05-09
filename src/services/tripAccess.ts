import { db } from "../db/database";
import type { Trip } from "../types";
import { pullAndMergeTrip } from "./tripSync";

export async function resolveTripByCode(code: string): Promise<Trip | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const merged = await pullAndMergeTrip(normalized);
  if (merged.ok) {
    const remoteTrip = await db.trips.where("tripCode").equals(normalized).first();
    if (remoteTrip) return remoteTrip;
  }
  return (await db.trips.where("tripCode").equals(normalized).first()) ?? null;
}

