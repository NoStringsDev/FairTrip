import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../db/database";
import { generateTripCode, newId } from "../utils/id";
import type { CurrencyCode, EntityKind, Trip, TripEntity } from "../types";
import { schedulePush } from "../services/tripSync";
import {
  CURRENCY_OPTIONS,
  DEFAULT_HOME_CURRENCY,
  DEFAULT_TRIP_CURRENCY,
} from "../domain/currencies";
import { ENTITY_PALETTE } from "../theme/entities";

export function CreateTrip() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const [tripName, setTripName] = useState("");
  const [tripNotes, setTripNotes] = useState("");
  const [participantCount, setParticipantCount] = useState<string>("4");

  const [homeCurrency, setHomeCurrency] =
    useState<CurrencyCode>(DEFAULT_HOME_CURRENCY);
  const [tripCurrency, setTripCurrency] =
    useState<CurrencyCode>(DEFAULT_TRIP_CURRENCY);
  const [extraCurrencies, setExtraCurrencies] = useState<
    Partial<Record<CurrencyCode, boolean>>
  >({});

  const [entityCount, setEntityCount] = useState(2);
  const [entityDrafts, setEntityDrafts] = useState<
    Array<{ name: string; kind: EntityKind; colorIndex: number }>
  >([
    { name: "Hunters", kind: "couple", colorIndex: 0 },
    { name: "Barrigaults", kind: "couple", colorIndex: 1 },
  ]);

  const supportedCurrencies = useMemo((): CurrencyCode[] => {
    const set = new Set<CurrencyCode>([homeCurrency, tripCurrency]);
    for (const { code: c } of CURRENCY_OPTIONS) {
      if (extraCurrencies[c]) set.add(c);
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

  function updateEntityRow(
    i: number,
    patch: Partial<{ name: string; kind: EntityKind; colorIndex: number }>
  ) {
    setEntityDrafts((rows) => {
      const next = [...rows];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  const canNext1 = tripName.trim().length > 0;
  const canNext2 = supportedCurrencies.length > 0;
  const canNext3 = entityDrafts.every((r) => r.name.trim().length > 0) && entityCount >= 2;

  async function finish() {
    setBusy(true);
    try {
      const entities: TripEntity[] = entityDrafts.slice(0, entityCount).map((d, i) => ({
        id: newId(),
        name: d.name.trim(),
        kind: d.kind,
        colorIndex: d.colorIndex % ENTITY_PALETTE.length,
      }));
      const trip: Trip = {
        id: newId(),
        name: tripName.trim(),
        tripNotes: tripNotes.trim() || undefined,
        participantCount: participantCount.trim()
          ? Number.parseInt(participantCount, 10)
          : undefined,
        supportedCurrencies,
        homeCurrency,
        tripCurrency,
        settlementCurrency: "GBP",
        tripCode: generateTripCode(),
        entities,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (Number.isNaN(trip.participantCount ?? NaN)) {
        trip.participantCount = undefined;
      }
      await db.trips.put(trip);
      void schedulePush(trip.id);
      nav(`/trip/${trip.id}/balance`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell stack create-trip">
      <div>
        <h1 className="title">New trip</h1>
        <p className="sub">Step {step} of 4 — set up who is travelling and how money is tracked.</p>
      </div>

      {step === 1 ? (
        <div className="card stack">
          <h2 className="title" style={{ fontSize: "1.05rem" }}>
            Basics
          </h2>
          <div className="field">
            <label>Trip name</label>
            <input
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              placeholder="e.g. Tokyo & Kyoto 2026"
            />
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
              placeholder="Flights, hotel, JR pass…"
            />
          </div>
          <div className="field">
            <label>Approx. number of people (optional)</label>
            <input
              inputMode="numeric"
              value={participantCount}
              onChange={(e) => setParticipantCount(e.target.value)}
              placeholder="e.g. 4"
            />
            <p className="sub" style={{ margin: "6px 0 0" }}>
              For your reference only. Balances are between the named groups below.
            </p>
          </div>
          <button
            className="btn"
            type="button"
            disabled={!canNext1}
            onClick={() => setStep(2)}
          >
            Next: currencies
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="card stack">
          <h2 className="title" style={{ fontSize: "1.05rem" }}>
            Currencies
          </h2>
          <p className="sub" style={{ marginTop: 0 }}>
            Settlement is always in <strong>GBP</strong>. Pick which currencies you will log expenses in.
          </p>
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
                      setExtraCurrencies((x) => ({
                        ...x,
                        [c.code]: e.target.checked,
                      }))
                    }
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" type="button" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              className="btn"
              type="button"
              disabled={!canNext2}
              onClick={() => setStep(3)}
            >
              Next: who splits
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="card stack">
          <h2 className="title" style={{ fontSize: "1.05rem" }}>
            Who is splitting costs?
          </h2>
          <p className="sub" style={{ marginTop: 0 }}>
            Add one row per <strong>couple</strong> or <strong>person</strong> that should have a running balance (2–6).
          </p>
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
            <div key={i} className="card stack" style={{ background: "#f8fafc" }}>
              <div className="field">
                <label>Name {i + 1}</label>
                <input
                  value={row.name}
                  onChange={(e) => updateEntityRow(i, { name: e.target.value })}
                  placeholder="e.g. Alex & Sam"
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
            <button className="btn btn-secondary" type="button" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              className="btn"
              type="button"
              disabled={!canNext3}
              onClick={() => setStep(4)}
            >
              Next: review
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="card stack">
          <h2 className="title" style={{ fontSize: "1.05rem" }}>
            Review
          </h2>
          <ul className="review-list">
            <li>
              <strong>Trip</strong> {tripName.trim()}
            </li>
            {tripNotes.trim() ? (
              <li>
                <strong>Notes</strong> {tripNotes.trim()}
              </li>
            ) : null}
            {participantCount.trim() ? (
              <li>
                <strong>People (approx.)</strong> {participantCount}
              </li>
            ) : null}
            <li>
              <strong>Currencies</strong> {supportedCurrencies.join(", ")}
            </li>
            <li>
              <strong>Balances between</strong>
              <ul>
                {entityDrafts.slice(0, entityCount).map((e, i) => (
                  <li key={i}>
                    {e.name.trim()} ({e.kind === "couple" ? "couple" : "individual"})
                  </li>
                ))}
              </ul>
            </li>
          </ul>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" type="button" onClick={() => setStep(3)}>
              Back
            </button>
            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={() => void finish()}
            >
              Create trip
            </button>
          </div>
        </div>
      ) : null}

      <button type="button" className="btn btn-ghost" onClick={() => nav("/welcome")}>
        Cancel
      </button>
    </div>
  );
}
