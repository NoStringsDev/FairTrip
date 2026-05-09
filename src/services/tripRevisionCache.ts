/**
 * Tracks last known server revision (max updated_at across trip + expenses) per tripCode,
 * used to avoid expensive full pulls when nothing changed server-side.
 */
import { fetchTripRevision } from "./sync";

/** Monotonic-ish server watermark; refreshed after successful pull or push snapshot. */
const revByTripCode = new Map<string, number>();

export function clearTripRevisionCache(tripCode: string): void {
  revByTripCode.delete(tripCode);
}

/** Read current server watermark and refresh cache entry. */
export async function snapshotTripRevisionNow(tripCode: string): Promise<void> {
  try {
    const r = await fetchTripRevision(tripCode);
    if (r.ok && r.rev !== null) revByTripCode.set(tripCode, r.rev);
  } catch {
    /* watermark is best-effort */
  }
}

/** True when we haven't recorded a watermark yet this session for this trip. */
export function hasTripRevisionWatermark(tripCode: string): boolean {
  return revByTripCode.has(tripCode);
}

export function getCachedTripRevision(tripCode: string): number | undefined {
  return revByTripCode.get(tripCode);
}
