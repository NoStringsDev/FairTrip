import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../db/database";
import { pullAndMergeTrip } from "../services/tripSync";

export function Welcome() {
  const nav = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function joinTrip() {
    setBusy(true);
    setErr(null);
    try {
      const code = joinCode.trim().toUpperCase();
      if (!code) {
        setErr("Enter trip code");
        return;
      }
      const merged = await pullAndMergeTrip(code);
      if (merged) {
        const t = await db.trips.where("tripCode").equals(code).first();
        if (t) {
          nav(`/trip/${t.id}/balance`);
          return;
        }
      }
      const local = await db.trips.where("tripCode").equals(code).first();
      if (local) {
        nav(`/trip/${local.id}/balance`);
        return;
      }
      setErr("Trip not found (check code or sync API)");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell stack">
      <div>
        <h1 className="title">FairTrip</h1>
        <p className="sub">
          Built for phones: log expenses in major global currencies, optional
          receipt scan, and
          settle everything back to GBP. Works offline; syncs when you are online.
        </p>
      </div>

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
          <label>Join with trip code</label>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABC12XYZ"
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
