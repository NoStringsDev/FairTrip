import { useEffect, useMemo, useState } from "react";
import { liveQuery } from "dexie";
import { Link, useOutletContext } from "react-router-dom";
import { db } from "../db/database";
import type { Expense, Trip } from "../types";
import { EntityChip } from "../components/EntityChip";
import { formatMinor } from "../domain/currency";
import { effectiveGbpFromExpense } from "../domain/effective";
import { normalizeExpense } from "../lib/expenseNormalize";
import { normalizeTrip } from "../lib/tripNormalize";
import { splitSummary } from "../lib/expenseLabels";
import { pullAndMergeTrip } from "../services/tripSync";
import { syncEnabled } from "../services/sync";

type Ctx = { trip: Trip };

function sameExpenseRows(a: Expense[], b: Expense[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.id !== right.id ||
      left.updatedAt !== right.updatedAt ||
      left.deletedAt !== right.deletedAt
    ) {
      return false;
    }
  }
  return true;
}

export function History() {
  const { trip: rawTrip } = useOutletContext<Ctx>();
  const trip = normalizeTrip(rawTrip);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payerFilter, setPayerFilter] = useState<string>("all");
  const [assignFilter, setAssignFilter] = useState<string>("all");

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const rows = await db.expenses.where("tripId").equals(trip.id).toArray();
      return rows.sort((a, b) => b.expenseTimestamp - a.expenseTimestamp);
    }).subscribe((next) => {
      setExpenses((prev) => (sameExpenseRows(prev, next) ? prev : next));
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [trip.id]);

  useEffect(() => {
    if (!syncEnabled()) return;
    const id = window.setInterval(() => {
      void pullAndMergeTrip(trip.tripCode);
    }, 3000);
    return () => {
      window.clearInterval(id);
    };
  }, [trip.tripCode]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (e.deletedAt) return false;
      const ex = normalizeExpense(e, trip);
      if (payerFilter !== "all" && ex.payerEntityId !== payerFilter) return false;
      if (assignFilter === "all") return true;
      if (assignFilter === "shared") return ex.splitMode === "shared_equal";
      return (
        ex.splitMode === "single" && ex.beneficiaryEntityId === assignFilter
      );
    });
  }, [assignFilter, expenses, payerFilter, trip]);

  return (
    <div className="stack">
      <div className="card row" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="field" style={{ flex: "1 1 160px", margin: 0 }}>
          <label>Payer</label>
          <select
            value={payerFilter}
            onChange={(e) => setPayerFilter(e.target.value)}
          >
            <option value="all">All</option>
            {trip.entities.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 180px", margin: 0 }}>
          <label>Assigned</label>
          <select
            value={assignFilter}
            onChange={(e) => setAssignFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="shared">Everyone (even split)</option>
            {trip.entities.map((ent) => (
              <option key={ent.id} value={ent.id}>
                For {ent.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card stack">
        {filtered.length === 0 ? (
          <p className="sub">No expenses match.</p>
        ) : (
          filtered.map((e) => {
            const eff = effectiveGbpFromExpense(e);
            const ex = normalizeExpense(e, trip);
            const payerEnt = trip.entities.find((x) => x.id === ex.payerEntityId);
            return (
              <Link
                key={e.id}
                to={`/trip/${trip.id}/expense/${e.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  className="row"
                  style={{
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderTop: "1px solid #f1f5f9",
                  }}
                >
                  <div className="stack" style={{ gap: 6 }}>
                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                      {payerEnt ? (
                        <EntityChip entity={payerEnt} size="sm" />
                      ) : null}
                      <span className="badge-fx">paid</span>
                      <span className="badge-fx">→ {splitSummary(trip, e)}</span>
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {e.note || "Expense"}
                    </div>
                    <div className="sub" style={{ fontSize: "0.75rem" }}>
                      {e.manualGbpMinorUnits != null
                        ? "Manual GBP override"
                        : e.fxRetrievalType === "currentFallback"
                          ? "FX: fallback rate"
                          : "FX: date rate"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800 }}>
                      {formatMinor(e.amountMinorUnits, e.currencyCode)}
                    </div>
                    <div className="sub" style={{ fontSize: "0.75rem" }}>
                      {eff ? (
                        <>≈ {formatMinor(eff.gbpMinor, "GBP")}</>
                      ) : (
                        <span className="badge-fx">FX pending</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
