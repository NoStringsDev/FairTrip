import { pullAndMergeTrip } from "./tripSync";

const inFlightByTripCode = new Map<string, Promise<boolean>>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

const DEFAULT_DEBOUNCE_MS = 400;

/**
 * Single-flight pull per trip: concurrent callers await the same in-flight merge.
 */
export async function executeTripPull(tripCode: string): Promise<boolean> {
  const existing = inFlightByTripCode.get(tripCode);
  if (existing) return existing;

  const next = pullAndMergeTrip(tripCode).finally(() => {
    if (inFlightByTripCode.get(tripCode) === next) {
      inFlightByTripCode.delete(tripCode);
    }
  });
  inFlightByTripCode.set(tripCode, next);
  return next;
}

/** Fire-and-forget debounced pull (e.g. visibility resume + bursts). */
export function scheduleDebouncedTripPull(
  tripCode: string,
  debounceMs: number = DEFAULT_DEBOUNCE_MS
): void {
  const prev = debounceTimers.get(tripCode);
  if (prev !== undefined) clearTimeout(prev);
  const id = globalThis.setTimeout(() => {
    debounceTimers.delete(tripCode);
    void executeTripPull(tripCode);
  }, debounceMs);
  debounceTimers.set(tripCode, id);
}
