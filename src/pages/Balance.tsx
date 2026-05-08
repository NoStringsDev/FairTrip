import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { db } from "../db/database";
import type { Expense, Trip } from "../types";
import { computeSettlement } from "../domain/settlement";
import { effectiveGbpFromExpense } from "../domain/effective";
import { formatMinor } from "../domain/currency";
import { EntityChip, EntityChipById } from "../components/EntityChip";
import { schedulePush } from "../services/tripSync";
import { normalizeTrip } from "../lib/tripNormalize";

type Ctx = { trip: Trip };
const EXPENSES_UPDATED_EVENT = "fairtrip:expenses-updated";

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

export function Balance() {
  const { trip: rawTrip } = useOutletContext<Ctx>();
  const trip = normalizeTrip(rawTrip);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      const rows = await db.expenses
        .where("tripId")
        .equals(trip.id)
        .sortBy("expenseTimestamp");
      if (!alive) return;
      const next = rows.reverse();
      setExpenses((prev) => (sameExpenseRows(prev, next) ? prev : next));
    }
    function onExpensesUpdated(e: Event) {
      const detail = (e as CustomEvent<{ tripId?: string }>).detail;
      if (detail?.tripId && detail.tripId !== trip.id) return;
      void load();
    }
    void load();
    window.addEventListener(EXPENSES_UPDATED_EVENT, onExpensesUpdated as EventListener);
    return () => {
      alive = false;
      window.removeEventListener(EXPENSES_UPDATED_EVENT, onExpensesUpdated as EventListener);
    };
  }, [trip.id]);

  const settlement = useMemo(
    () => computeSettlement(trip, expenses, effectiveGbpFromExpense),
    [expenses, trip]
  );

  const paidByEntity = useMemo(() => {
    const m = new Map<string, number>();
    for (const ent of trip.entities) m.set(ent.id, 0);
    for (const e of expenses) {
      if (e.deletedAt) continue;
      const eff = effectiveGbpFromExpense(e);
      if (!eff) continue;
      const ex = normalizeExpense(e, trip);
      m.set(ex.payerEntityId, (m.get(ex.payerEntityId) ?? 0) + eff.gbpMinor);
    }
    return m;
  }, [expenses, trip]);

  const exportText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`${trip.name} — settlement (GBP)`);
    lines.push(`Trip code: ${trip.tripCode}`);
    if (settlement.settled) lines.push("All square — no transfers needed.");
    else {
      for (const tfr of settlement.transfers) {
        const fromN =
          trip.entities.find((x) => x.id === tfr.fromEntityId)?.name ?? "Unknown";
        const toN =
          trip.entities.find((x) => x.id === tfr.toEntityId)?.name ?? "Unknown";
        lines.push(
          `${fromN} pays ${toN} ${formatMinor(tfr.amountGbpMinor, "GBP")}`
        );
      }
    }
    lines.push("");
    lines.push("Paid totals (GBP, after FX / overrides):");
    for (const ent of trip.entities) {
      lines.push(
        `${ent.name}: ${formatMinor(paidByEntity.get(ent.id) ?? 0, "GBP")}`
      );
    }
    return lines.join("\n");
  }, [paidByEntity, settlement, trip]);

  async function closeTrip() {
    if (!confirm("Close trip? You can still view history.")) return;
    await db.trips.update(trip.id, {
      closedAt: Date.now(),
      updatedAt: Date.now(),
    });
    void schedulePush(trip.id);
  }

  async function reopenTrip() {
    if (!confirm("Reopen trip and allow new expenses again?")) return;
    await db.trips.update(trip.id, {
      closedAt: undefined,
      updatedAt: Date.now(),
    });
    void schedulePush(trip.id);
  }

  async function copyExport() {
    await navigator.clipboard.writeText(exportText);
    alert("Copied summary to clipboard");
  }

  return (
    <div className="stack">
      {trip.tripNotes ? (
        <div className="card">
          <p className="sub" style={{ margin: 0 }}>
            <strong>Notes</strong> {trip.tripNotes}
          </p>
        </div>
      ) : null}

      <div className="card stack">
        <h2 className="title" style={{ fontSize: "1rem" }}>
          Running tally (paid out)
        </h2>
        <div className="paid-grid">
          {trip.entities.map((ent) => (
            <div key={ent.id} className="paid-grid__cell">
              <EntityChip entity={ent} />
              <strong className="paid-grid__amt">
                {formatMinor(paidByEntity.get(ent.id) ?? 0, "GBP")}
              </strong>
            </div>
          ))}
        </div>
        <p className="sub" style={{ margin: 0 }}>
          Shows who actually paid, in GBP terms (FX per expense date, unless
          overridden).
        </p>
      </div>

      <div className="card stack">
        <h2 className="title" style={{ fontSize: "1rem" }}>
          Final settlement (GBP)
        </h2>
        {settlement.settled ? (
          <p style={{ margin: 0 }}>All square — no transfers needed.</p>
        ) : (
          <ul className="settle-list">
            {settlement.transfers.map((tfr, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <EntityChipById trip={trip} entityId={tfr.fromEntityId} /> pays{" "}
                <EntityChipById trip={trip} entityId={tfr.toEntityId} />{" "}
                <strong>{formatMinor(tfr.amountGbpMinor, "GBP")}</strong>
              </li>
            ))}
          </ul>
        )}
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void copyExport()}
          >
            Copy summary
          </button>
          {!trip.closedAt ? (
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => void closeTrip()}
            >
              Close trip
            </button>
          ) : (
            <>
              <span className="badge-fx">Trip closed</span>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => void reopenTrip()}
              >
                Reopen trip
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
