import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../db/database";
import { clearLastTripId, getLastTripId, setLastTripId } from "../lib/lastTrip";
import { TRIP_CODE_LENGTH } from "../utils/id";
import { resolveTripByCode } from "../services/tripAccess";
import { normalizeTrip } from "../lib/tripNormalize";

export function Welcome() {
  const nav = useNavigate();
  const [search] = useSearchParams();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastTripName, setLastTripName] = useState<string | null>(null);
  const autoJoinAttempted = useRef(false);

  const attemptJoin = useCallback(async (codeInput: string): Promise<boolean> => {
    const code = codeInput.trim().toUpperCase();
    if (!code) {
      setErr("Enter trip code");
      return false;
    }
    try {
      const trip = await resolveTripByCode(code);
      if (trip) {
        setLastTripId(trip.id);
        nav(`/trip/${trip.id}/balance`);
        return true;
      }
      setErr("Trip not found (check code or sync API)");
      return false;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      return false;
    }
  }, [nav]);

  async function joinTrip() {
    setBusy(true);
    setErr(null);
    try {
      await attemptJoin(joinCode);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let alive = true;
    async function loadLastTrip() {
      const lastTripId = getLastTripId();
      if (!lastTripId) {
        if (alive) setLastTripName(null);
        return;
      }
      const trip = await db.trips.get(lastTripId);
      if (!trip) {
        clearLastTripId();
        if (alive) setLastTripName(null);
        return;
      }
      if (alive) setLastTripName(normalizeTrip(trip).name);
    }
    void loadLastTrip();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (autoJoinAttempted.current) return;
    const code = search.get("tripCode")?.trim().toUpperCase();
    if (!code) return;
    autoJoinAttempted.current = true;
    setJoinCode(code);
    setBusy(true);
    setErr(search.get("joinError") ? "Shared link failed. Try again below." : null);
    void attemptJoin(code).finally(() => setBusy(false));
  }, [search, attemptJoin]);

  async function goToLastTrip() {
    const lastTripId = getLastTripId();
    if (!lastTripId) return;
    const trip = await db.trips.get(lastTripId);
    if (!trip) {
      clearLastTripId();
      setLastTripName(null);
      return;
    }
    nav(`/trip/${trip.id}/balance`);
  }

  return (
    <div className="app-shell stack">
      <div>
        <h1 className="title">Split trip costs fairly</h1>
      </div>

      {lastTripName ? (
        <div className="card stack">
          <button
            className="btn btn-secondary btn-lg"
            type="button"
            disabled={busy}
            onClick={() => void goToLastTrip()}
          >
            Return to {lastTripName}
          </button>
          <p className="sub" style={{ margin: 0 }}>
            Quick way back if you accidentally left your active trip.
          </p>
        </div>
      ) : null}

      <div className="card stack">
        <button
          className="btn btn-lg"
          type="button"
          disabled={busy}
          onClick={() => nav("/create")}
        >
          Start new trip
        </button>
        <p className="sub" style={{ margin: 0 }}>
          You will choose trip details, currencies, and who shares balances (couples
          or individuals).
        </p>
      </div>

      <div className="card stack">
        <div className="field">
          <label>Join with trip code ({TRIP_CODE_LENGTH} characters)</label>
          <input
            value={joinCode}
            maxLength={TRIP_CODE_LENGTH}
            onChange={(e) =>
              setJoinCode(e.target.value.toUpperCase().slice(0, TRIP_CODE_LENGTH))
            }
            placeholder="e.g. X7K2"
            autoCapitalize="characters"
          />
        </div>
        <button
          className="btn btn-secondary btn-lg"
          disabled={busy}
          onClick={() => void joinTrip()}
        >
          Join existing trip
        </button>
      </div>

      {err ? (
        <div className="card" style={{ color: "var(--danger)" }}>
          {err}
        </div>
      ) : null}
    </div>
  );
}
