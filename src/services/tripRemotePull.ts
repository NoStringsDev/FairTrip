import {
  snapshotTripRevisionNow,
  clearTripRevisionCache,
  getCachedTripRevision,
  hasTripRevisionWatermark,
} from "./tripRevisionCache";
import { fetchTripRevision } from "./sync";
import { pullAndMergeTrip, type PullMergeResult } from "./tripSync";

const inFlightByTripCode = new Map<string, Promise<PullMergeResult>>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

const DEFAULT_DEBOUNCE_MS = 400;

async function finalizePullWatermark(
  tripCode: string,
  result: PullMergeResult
): Promise<PullMergeResult> {
  if (result.ok) await snapshotTripRevisionNow(tripCode);
  return result;
}

/**
 * Single-flight pull per trip: concurrent callers await the same in-flight merge.
 */
export async function executeTripPull(tripCode: string): Promise<PullMergeResult> {
  const existing = inFlightByTripCode.get(tripCode);
  if (existing) return existing;

  const merged = pullAndMergeTrip(tripCode).then((r) =>
    finalizePullWatermark(tripCode, r)
  );
  const next = merged.finally(() => {
    if (inFlightByTripCode.get(tripCode) === next) {
      inFlightByTripCode.delete(tripCode);
    }
  });
  inFlightByTripCode.set(tripCode, next);
  return next;
}

/** Full pull only when server revision watermark differs (~cheap GET `/api/sync/rev`). */
export async function reconcileTripIfRemoteChanged(
  tripCode: string,
  onPullResult?: (r: PullMergeResult) => void
): Promise<void> {
  if (!hasTripRevisionWatermark(tripCode)) return;

  const prev = getCachedTripRevision(tripCode);
  if (prev === undefined) return;

  const meta = await fetchTripRevision(tripCode);
  if (!meta.ok || meta.rev === null) return;

  if (meta.rev !== prev) {
    const r = await executeTripPull(tripCode);
    onPullResult?.(r);
  }
}

/** Fire-and-forget debounced pull (e.g. visibility resume + bursts). */
export function scheduleDebouncedTripPull(
  tripCode: string,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
  onPullResult?: (r: PullMergeResult) => void
): void {
  const prev = debounceTimers.get(tripCode);
  if (prev !== undefined) clearTimeout(prev);
  const id = globalThis.setTimeout(() => {
    debounceTimers.delete(tripCode);
    void executeTripPull(tripCode).then((r) => onPullResult?.(r));
  }, debounceMs);
  debounceTimers.set(tripCode, id);
}

export { clearTripRevisionCache };
