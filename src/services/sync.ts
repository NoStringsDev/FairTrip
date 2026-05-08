/**
 * API base URL:
 * - VITE_API_URL when explicitly configured
 * - same-origin in production (single Worker serving app + API)
 * - disabled in local Vite dev unless env var is set
 */
import type { QuoteCurrency } from "../types";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

const configuredApi = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const PRIMARY_API_BASE = configuredApi
  ? trimTrailingSlash(configuredApi)
  : import.meta.env.PROD
    ? ""
    : null;
const PULL_API_BASES = Array.from(
  new Set(
    [PRIMARY_API_BASE, import.meta.env.PROD ? "" : null].filter(
      (value): value is string => value !== null
    )
  )
);

function apiUrl(path: string, base: string): string {
  return `${base}/api${path}`;
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.trim();
  } catch {
    return "";
  }
}

async function fetchWithFallback(path: string, init?: RequestInit): Promise<Response> {
  let lastError: string | null = null;
  for (const base of PULL_API_BASES) {
    const url = apiUrl(path, base);
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      const body = await readErrorBody(res);
      lastError = body || `Sync API request failed (${res.status}) at ${url}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Network request failed";
    }
  }
  throw new Error(lastError ?? "Sync API is unavailable");
}

export function syncEnabled(): boolean {
  return PRIMARY_API_BASE !== null;
}

export async function pushTripAndExpenses(payload: unknown): Promise<void> {
  if (!PRIMARY_API_BASE) return;
  const res = await fetch(apiUrl("/sync/push", PRIMARY_API_BASE), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await readErrorBody(res);
    throw new Error(t || `Sync failed ${res.status}`);
  }
}

export async function pullTrip(tripCode: string): Promise<unknown | null> {
  if (!syncEnabled()) return null;
  let lastError: string | null = null;
  for (const base of PULL_API_BASES) {
    const url = apiUrl(`/sync/pull?tripCode=${encodeURIComponent(tripCode)}`, base);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await readErrorBody(res);
        lastError = body || `Sync pull failed (${res.status}) at ${url}`;
        continue;
      }
      const data = (await res.json()) as { trip?: unknown | null } | null;
      if (data?.trip) return data;
      // If this backend returns not-found, try the next candidate backend.
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Network request failed";
    }
  }
  if (lastError) throw new Error(lastError);
  return null;
}

export async function uploadReceipt(
  tripCode: string,
  expenseId: string,
  file: Blob
): Promise<{ r2Key: string } | null> {
  if (!PRIMARY_API_BASE) return null;
  const fd = new FormData();
  fd.append("tripCode", tripCode);
  fd.append("expenseId", expenseId);
  fd.append("file", file, "receipt.jpg");
  const res = await fetch(apiUrl("/receipts", PRIMARY_API_BASE), {
    method: "POST",
    body: fd,
  });
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
  if (!PRIMARY_API_BASE) return null;
  const res = await fetch(
    apiUrl(
      `/fx?date=${encodeURIComponent(isoDate)}&currency=${encodeURIComponent(currency)}`,
      PRIMARY_API_BASE
    )
  );
  if (!res.ok) return null;
  return res.json() as Promise<{
    gbpPerUnit: number;
    rateDate: string;
    retrievalType: string;
  }>;
}
