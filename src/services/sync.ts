/**
 * Optional Cloudflare Worker sync. If VITE_API_URL is unset, only local IndexedDB is used.
 */
import type { QuoteCurrency } from "../types";

const API = (import.meta.env.VITE_API_URL as string | undefined) || "";

export function syncEnabled(): boolean {
  return Boolean(API);
}

export async function pushTripAndExpenses(payload: unknown): Promise<void> {
  if (!API) return;
  const res = await fetch(`${API}/api/sync/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Sync failed ${res.status}`);
  }
}

export async function pullTrip(tripCode: string): Promise<unknown | null> {
  if (!API) return null;
  const res = await fetch(
    `${API}/api/sync/pull?tripCode=${encodeURIComponent(tripCode)}`
  );
  if (!res.ok) return null;
  return res.json();
}

export async function uploadReceipt(
  tripCode: string,
  expenseId: string,
  file: Blob
): Promise<{ r2Key: string } | null> {
  if (!API) return null;
  const fd = new FormData();
  fd.append("tripCode", tripCode);
  fd.append("expenseId", expenseId);
  fd.append("file", file, "receipt.jpg");
  const res = await fetch(`${API}/api/receipts`, { method: "POST", body: fd });
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
  if (!API) return null;
  const res = await fetch(
    `${API}/api/fx?date=${encodeURIComponent(isoDate)}&currency=${encodeURIComponent(currency)}`
  );
  if (!res.ok) return null;
  return res.json() as Promise<{
    gbpPerUnit: number;
    rateDate: string;
    retrievalType: string;
  }>;
}
