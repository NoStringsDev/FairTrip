export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Uppercase alphanumeric without ambiguous characters (O/0, I/1). */
export const TRIP_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TRIP_CODE_LENGTH = 4;

export function generateTripCode(): string {
  let s = "";
  for (let i = 0; i < TRIP_CODE_LENGTH; i++) {
    s += TRIP_CODE_CHARS[Math.floor(Math.random() * TRIP_CODE_CHARS.length)];
  }
  return s;
}
