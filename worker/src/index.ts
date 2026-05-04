export interface Env {
  DB: D1Database;
  RECEIPTS: R2Bucket;
}

// Minimal ambient types so the repo typechecks without Cloudflare-specific tooling.
declare global {
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
  }
  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(): Promise<T | null>;
    all<T = unknown>(): Promise<{ results?: T[] }>;
    run(): Promise<unknown>;
  }
  interface R2Bucket {
    put(
      key: string,
      value: ReadableStream | ArrayBuffer | Blob,
      options?: { httpMetadata?: { contentType?: string } }
    ): Promise<unknown>;
  }
}

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});

function json(data: unknown, env: Env, origin: string | null, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
    },
  });
}

async function readFrankfurter(path: string) {
  const res = await fetch(`https://api.frankfurter.app${path}`);
  if (!res.ok) return null;
  return res.json() as Promise<{
    date?: string;
    rates?: Partial<Record<string, number>>;
  }>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/fx" && request.method === "GET") {
        const date = url.searchParams.get("date");
        const cur = (url.searchParams.get("currency") ?? "JPY").toUpperCase();
        if (!date) return json({ error: "date required" }, env, origin, 400);
        if (cur === "GBP") {
          return json(
            { gbpPerUnit: 1, rateDate: date, retrievalType: "historical" },
            env,
            origin
          );
        }
        let data = await readFrankfurter(`/${date}?from=GBP&to=${cur}`);
        let retrieval: "historical" | "currentFallback" = "historical";
        let rateDate = date;
        if (!data?.rates?.[cur] || (data.rates[cur] ?? 0) <= 0) {
          data = await readFrankfurter(`/latest?from=GBP&to=${cur}`);
          retrieval = "currentFallback";
          rateDate = data?.date ?? date;
        }
        const perGbp = data?.rates?.[cur];
        if (!perGbp || perGbp <= 0) {
          return json({ error: "rate unavailable" }, env, origin, 502);
        }
        const gbpPerUnit = 1 / perGbp;
        const id = `${rateDate}|GBP|${cur}`;
        await env.DB.prepare(
          `INSERT INTO fx_rates (id, rate_date, base, quote, gbp_per_jpy, retrieval_type, fetched_at)
             VALUES (?, ?, 'GBP', ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET gbp_per_jpy=excluded.gbp_per_jpy, retrieval_type=excluded.retrieval_type, fetched_at=excluded.fetched_at`
        )
          .bind(id, rateDate, cur, gbpPerUnit, retrieval, Date.now())
          .run();
        return json(
          { gbpPerUnit, rateDate, retrievalType: retrieval },
          env,
          origin
        );
      }

      if (url.pathname === "/api/sync/push" && request.method === "POST") {
        const body = (await request.json()) as {
          trip: {
            id: string;
            name: string;
            homeCurrency: string;
            tripCurrency: string;
            settlementCurrency: string;
            tripCode: string;
            createdAt: number;
            closedAt?: number;
            updatedAt: number;
            tripNotes?: string;
            participantCount?: number;
            supportedCurrencies?: string[];
            entities?: unknown[];
          };
          expenses: Array<{
            id: string;
            tripId: string;
            amountMinorUnits: number;
            currencyCode: string;
            payerEntityId: string;
            splitMode: string;
            beneficiaryEntityId?: string;
            payerCouple?: string;
            assignedTo?: string;
            note: string;
            category: string;
            expenseTimestamp: number;
            receiptR2Key?: string;
            manualGbpMinorUnits?: number;
            fxRateUsed?: number;
            fxRateDateUsed?: string;
            fxRetrievalType?: string;
            convertedGbpMinorUnits?: number;
            conversionMode: string;
            deletedAt?: number;
            updatedAt: number;
          }>;
        };
        const t = body.trip;
        const entitiesJson = t.entities ? JSON.stringify(t.entities) : null;
        const supportedJson = t.supportedCurrencies
          ? JSON.stringify(t.supportedCurrencies)
          : null;
        await env.DB.prepare(
          `INSERT INTO trips (id, name, home_currency, trip_currency, settlement_currency, trip_code, created_at, closed_at, updated_at, entities_json, supported_currencies_json, participant_count, trip_notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name=excluded.name,
             closed_at=excluded.closed_at,
             updated_at=CASE WHEN excluded.updated_at > trips.updated_at THEN excluded.updated_at ELSE trips.updated_at END,
             entities_json=COALESCE(excluded.entities_json, trips.entities_json),
             supported_currencies_json=COALESCE(excluded.supported_currencies_json, trips.supported_currencies_json),
             participant_count=COALESCE(excluded.participant_count, trips.participant_count),
             trip_notes=COALESCE(excluded.trip_notes, trips.trip_notes)`
        )
          .bind(
            t.id,
            t.name,
            t.homeCurrency,
            t.tripCurrency,
            t.settlementCurrency,
            t.tripCode,
            t.createdAt,
            t.closedAt ?? null,
            t.updatedAt,
            entitiesJson,
            supportedJson,
            t.participantCount ?? null,
            t.tripNotes ?? null
          )
          .run();

        for (const e of body.expenses) {
          const existing = await env.DB.prepare(
            `SELECT updated_at FROM expenses WHERE id = ?`
          )
            .bind(e.id)
            .first<{ updated_at: number }>();
          if (existing && existing.updated_at >= e.updatedAt) continue;
          const payerId = e.payerEntityId ?? e.payerCouple ?? "";
          const assignedDb =
            e.splitMode === "shared_equal"
              ? "shared_equal"
              : e.beneficiaryEntityId ?? e.assignedTo ?? "";
          await env.DB.prepare(
            `INSERT INTO expenses (
              id, trip_id, amount_minor, currency, payer_couple, assigned_to, note, category,
              expense_timestamp, receipt_r2_key, manual_gbp_minor, fx_rate_used, fx_rate_date_used,
              fx_retrieval_type, converted_gbp_minor, conversion_mode, deleted_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              trip_id=excluded.trip_id,
              amount_minor=excluded.amount_minor,
              currency=excluded.currency,
              payer_couple=excluded.payer_couple,
              assigned_to=excluded.assigned_to,
              note=excluded.note,
              category=excluded.category,
              expense_timestamp=excluded.expense_timestamp,
              receipt_r2_key=excluded.receipt_r2_key,
              manual_gbp_minor=excluded.manual_gbp_minor,
              fx_rate_used=excluded.fx_rate_used,
              fx_rate_date_used=excluded.fx_rate_date_used,
              fx_retrieval_type=excluded.fx_retrieval_type,
              converted_gbp_minor=excluded.converted_gbp_minor,
              conversion_mode=excluded.conversion_mode,
              deleted_at=excluded.deleted_at,
              updated_at=excluded.updated_at`
          )
            .bind(
              e.id,
              e.tripId,
              e.amountMinorUnits,
              e.currencyCode,
              payerId,
              assignedDb,
              e.note,
              e.category,
              e.expenseTimestamp,
              e.receiptR2Key ?? null,
              e.manualGbpMinorUnits ?? null,
              e.fxRateUsed ?? null,
              e.fxRateDateUsed ?? null,
              e.fxRetrievalType ?? null,
              e.convertedGbpMinorUnits ?? null,
              e.conversionMode,
              e.deletedAt ?? null,
              e.updatedAt
            )
            .run();
        }
        return json({ ok: true }, env, origin);
      }

      if (url.pathname === "/api/sync/pull" && request.method === "GET") {
        const tripCode = url.searchParams.get("tripCode");
        if (!tripCode) return json({ error: "tripCode" }, env, origin, 400);
        const trip = await env.DB.prepare(
          `SELECT * FROM trips WHERE trip_code = ?`
        )
          .bind(tripCode)
          .first();
        if (!trip) return json({ trip: null, expenses: [] }, env, origin);
        const expenses = await env.DB.prepare(
          `SELECT * FROM expenses WHERE trip_id = ?`
        )
          .bind(trip.id)
          .all();
        return json({ trip, expenses: expenses.results ?? [] }, env, origin);
      }

      if (url.pathname === "/api/receipts" && request.method === "POST") {
        const form = await request.formData();
        const tripCode = String(form.get("tripCode") ?? "");
        const expenseId = String(form.get("expenseId") ?? "");
        const file = form.get("file");
        if (!tripCode || !expenseId || !(file instanceof File)) {
          return json({ error: "invalid form" }, env, origin, 400);
        }
        const trip = await env.DB.prepare(
          `SELECT id FROM trips WHERE trip_code = ?`
        )
          .bind(tripCode)
          .first<{ id: string }>();
        if (!trip) return json({ error: "unknown trip" }, env, origin, 404);
        const key = `${trip.id}/${expenseId}.jpg`;
        const buf = await file.arrayBuffer();
        await env.RECEIPTS.put(key, buf, {
          httpMetadata: { contentType: file.type || "image/jpeg" },
        });
        await env.DB.prepare(
          `UPDATE expenses SET receipt_r2_key = ?, updated_at = ? WHERE id = ?`
        )
          .bind(key, Date.now(), expenseId)
          .run();
        return json({ r2Key: key }, env, origin);
      }

      return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      return json({ error: msg }, env, origin, 500);
    }
  },
};
