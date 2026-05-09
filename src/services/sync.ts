/**
 * API base URL:
 * - VITE_API_URL when explicitly configured
 * - same-origin in production (single Worker serving app + API)
 * - disabled in local Vite dev unless env var is set
 */
import type { QuoteCurrency } from "../types";

const API =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.PROD ? "" : null);
const API_PREFIX = API === null ? null : `${API}/api`;

export function syncEnabled(): boolean {
  return API_PREFIX !== null;
}

export async function pushTripAndExpenses(payload: unknown): Promise<void> {
  if (!API_PREFIX) return;
  const res = await fetch(`${API_PREFIX}/sync/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Sync failed ${res.status}`);
  }
}

export type PullTripFetchResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: "disabled" | "network" | "http"; status?: number };

/** Fetch `/api/sync/pull` with explicit failure reasons (no silent null). */
export async function pullTripFetch(tripCode: string): Promise<PullTripFetchResult> {
  if (!API_PREFIX) return { ok: false, reason: "disabled" };
  try {
    const res = await fetch(
      `${API_PREFIX}/sync/pull?tripCode=${encodeURIComponent(tripCode)}`
    );
    if (!res.ok) {
      return { ok: false, reason: "http", status: res.status };
    }
    try {
      return { ok: true, data: await res.json() };
    } catch {
      return { ok: false, reason: "http", status: res.status };
    }
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** @deprecated Prefer pullTripFetch for error visibility */
export async function pullTrip(tripCode: string): Promise<unknown | null> {
  const r = await pullTripFetch(tripCode);
  if (!r.ok) return null;
  return r.data;
}

export async function uploadReceipt(
  tripCode: string,
  expenseId: string,
  file: Blob
): Promise<{ r2Key: string } | null> {
  if (!API_PREFIX) return null;
  const fd = new FormData();
  fd.append("tripCode", tripCode);
  fd.append("expenseId", expenseId);
  fd.append("file", file, "receipt.jpg");
  const res = await fetch(`${API_PREFIX}/receipts`, { method: "POST", body: fd });
  if (!res.ok) return null;
  return res.json() as Promise<{ r2Key: string }>;
}

export async function fetchFxFromServer(
  isoDate: string,
  currency: QuoteCurrency
): Promise<{
  gbpPerUnit: number;
  rateDate: string;
  retrievalType: string;
} | null> {
  if (!API_PREFIX) return null;
  const res = await fetch(
    `${API_PREFIX}/fx?date=${encodeURIComponent(isoDate)}&currency=${encodeURIComponent(currency)}`
  );
  if (!res.ok) return null;
  return res.json() as Promise<{
    gbpPerUnit: number;
    rateDate: string;
    retrievalType: string;
  }>;
}
