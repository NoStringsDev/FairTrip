import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { db } from "../db/database";
import { newId } from "../utils/id";
import type { CurrencyCode, EntityKind, Trip } from "../types";
import { schedulePush } from "../services/tripSync";
import {
  CURRENCY_OPTIONS,
  labelForCurrency,
} from "../domain/currencies";
import { ENTITY_PALETTE } from "../theme/entities";
import { normalizeTrip } from "../lib/tripNormalize";

type Ctx = { trip: Trip };
type EntityDraft = {
  id?: string;
  name: string;
  kind: EntityKind;
  colorIndex: number;
};

export function EditTrip() {
  const { trip: rawTrip } = useOutletContext<Ctx>();
  const trip = normalizeTrip(rawTrip);
  const nav = useNavigate();

  const [tripName, setTripName] = useState(trip.name);
  const [tripNotes, setTripNotes] = useState(trip.tripNotes ?? "");
  const [participantCount, setParticipantCount] = useState<string>(
    trip.participantCount != null ? String(trip.participantCount) : ""
  );
  const [homeCurrency, setHomeCurrency] = useState<CurrencyCode>(trip.homeCurrency);
  const [tripCurrency, setTripCurrency] = useState<CurrencyCode>(trip.tripCurrency);
  const [extraCurrencies, setExtraCurrencies] = useState<
    Partial<Record<CurrencyCode, boolean>>
  >(() => {
    const next: Partial<Record<CurrencyCode, boolean>> = {};
    for (const c of trip.supportedCurrencies) {
      if (c !== trip.homeCurrency && c !== trip.tripCurrency) next[c] = true;
    }
    return next;
  });
  const [entityCount, setEntityCount] = useState(trip.entities.length);
  const [entityDrafts, setEntityDrafts] = useState<EntityDraft[]>(
    trip.entities.map((ent) => ({
      id: ent.id,
      name: ent.name,
      kind: ent.kind,
      colorIndex: ent.colorIndex,
    }))
  );
  const [busy, setBusy] = useState(false);

  const supportedCurrencies = useMemo((): CurrencyCode[] => {
    const set = new Set<CurrencyCode>([homeCurrency, tripCurrency]);
    for (const { code } of CURRENCY_OPTIONS) {
      if (extraCurrencies[code]) set.add(code);
    }
    return Array.from(set);
  }, [extraCurrencies, homeCurrency, tripCurrency]);

  const alsoUseCurrencies = useMemo(
    () =>
      CURRENCY_OPTIONS.filter(
        (c) => c.code !== homeCurrency && c.code !== tripCurrency
      ),
    [homeCurrency, tripCurrency]
  );

  const canSave = tripName.trim().length > 0 && entityCount >= 2;

  function syncEntityRows(n: number) {
    setEntityDrafts((prev) => {
      const next = [...prev];
      while (next.length < n) {
        next.push({
          name: `Group ${next.length + 1}`,
          kind: "couple",
          colorIndex: next.length % ENTITY_PALETTE.length,
        });
      }
      while (next.length > n) next.pop();
      return next;
    });
  }

  function updateEntityRow(i: number, patch: Partial<EntityDraft>) {
    setEntityDrafts((rows) => {
      const next = [...rows];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      const nextEntities = entityDrafts.slice(0, entityCount).map((d) => ({
        id: d.id ?? newId(),
        name: d.name.trim(),
        kind: d.kind,
        colorIndex: d.colorIndex % ENTITY_PALETTE.length,
      }));
      if (nextEntities.some((x) => x.name.length === 0)) return;

      const removedIds = trip.entities
        .map((e) => e.id)
        .filter((id) => !nextEntities.some((n) => n.id === id));
      if (removedIds.length > 0) {
        const expenses = await db.expenses.where("tripId").equals(trip.id).toArray();
        const inUse = removedIds.some((id) =>
          expenses.some(
            (e) =>
              e.payerEntityId === id || e.beneficiaryEntityId === id
          )
        );
        if (inUse) {
          alert(
            "Cannot remove entities that are already referenced by existing expenses."
          );
          return;
        }
      }

      const nextTrip: Trip = {
        ...trip,
        name: tripName.trim(),
        tripNotes: tripNotes.trim() || undefined,
        participantCount: participantCount.trim()
          ? Number.parseInt(participantCount, 10)
          : undefined,
        homeCurrency,
        tripCurrency,
        supportedCurrencies,
        entities: nextEntities,
        updatedAt: Date.now(),
      };
      if (Number.isNaN(nextTrip.participantCount ?? NaN)) {
        nextTrip.participantCount = undefined;
      }
      await db.trips.put(nextTrip);
      void schedulePush(trip.id);
      nav(`/trip/${trip.id}/balance`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="card stack">
        <h2 className="title" style={{ fontSize: "1rem" }}>
          Edit trip details
        </h2>

        <div className="field">
          <label>Trip name</label>
          <input value={tripName} onChange={(e) => setTripName(e.target.value)} />
          <p className="sub" style={{ margin: "6px 0 0" }}>
            Use a clear name you can recognize later, such as destination plus
            month/year.
          </p>
        </div>

        <div className="field">
          <label>Notes (optional)</label>
          <textarea
            rows={3}
            value={tripNotes}
            onChange={(e) => setTripNotes(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Approx. number of people (optional)</label>
          <input
            inputMode="numeric"
            value={participantCount}
            onChange={(e) => setParticipantCount(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Home / card currency</label>
          <select
            value={homeCurrency}
            onChange={(e) => setHomeCurrency(e.target.value as CurrencyCode)}
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Main trip currency</label>
          <select
            value={tripCurrency}
            onChange={(e) => setTripCurrency(e.target.value as CurrencyCode)}
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Also use</label>
          <div className="stack" style={{ gap: 8 }}>
            {alsoUseCurrencies.map((c) => (
              <label key={c.code} className="row" style={{ gap: 10 }}>
                <input
                  type="checkbox"
                  checked={Boolean(extraCurrencies[c.code])}
                  onChange={(e) =>
                    setExtraCurrencies((x) => ({ ...x, [c.code]: e.target.checked }))
                  }
                />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
          <p className="sub" style={{ margin: "6px 0 0" }}>
            Active: {supportedCurrencies.map((c) => labelForCurrency(c)).join(", ")}
          </p>
        </div>

        <div className="field">
          <label>Number of balances</label>
          <select
            value={entityCount}
            onChange={(e) => {
              const n = Number(e.target.value);
              setEntityCount(n);
              syncEntityRows(n);
            }}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {entityDrafts.slice(0, entityCount).map((row, i) => (
          <div key={row.id ?? i} className="card stack" style={{ background: "#f8fafc" }}>
            <div className="field">
              <label>Name {i + 1}</label>
              <input
                value={row.name}
                onChange={(e) => updateEntityRow(i, { name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Type</label>
              <select
                value={row.kind}
                onChange={(e) =>
                  updateEntityRow(i, { kind: e.target.value as EntityKind })
                }
              >
                <option value="couple">Couple / household</option>
                <option value="individual">Individual</option>
              </select>
            </div>
            <div className="field">
              <label>Colour</label>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {ENTITY_PALETTE.map((c, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Select colour ${idx + 1}`}
                    className={row.colorIndex === idx ? "btn" : "btn btn-ghost"}
                    style={{
                      minWidth: 40,
                      padding: "8px 10px",
                      borderColor: c.border,
                      background: row.colorIndex === idx ? c.bg : undefined,
                      color: c.text,
                    }}
                    onClick={() => updateEntityRow(i, { colorIndex: idx })}
                  >
                    <span
                      aria-hidden
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        background: c.chip,
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn"
            type="button"
            disabled={!canSave || busy}
            onClick={() => void save()}
          >
            Save trip
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => nav(`/trip/${trip.id}/balance`)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

