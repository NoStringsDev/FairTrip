const LAST_TRIP_ID_KEY = "fairtrip:lastTripId";

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getLastTripId(): string | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(LAST_TRIP_ID_KEY);
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

export function setLastTripId(tripId: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(LAST_TRIP_ID_KEY, tripId);
  } catch {
    // Ignore storage failures on locked-down devices/browsers.
  }
}

export function clearLastTripId(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(LAST_TRIP_ID_KEY);
  } catch {
    // Ignore storage failures on locked-down devices/browsers.
  }
}

