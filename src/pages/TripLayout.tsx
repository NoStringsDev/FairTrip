import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useParams } from "react-router-dom";
import { db } from "../db/database";
import type { Trip } from "../types";
import { FloatingAddButton } from "../components/FloatingAddButton";
import { MobileTripNav } from "../components/MobileTripNav";
import { syncEnabled } from "../services/sync";
import { flushSyncQueue } from "../services/tripSync";
import { normalizeTrip } from "../lib/tripNormalize";

export function TripLayout() {
  const { tripId } = useParams();
  const nav = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    if (!tripId) return;
    let alive = true;
    async function load() {
      const t = await db.trips.get(tripId);
      if (!alive) return;
      if (!t) nav("/");
      else setTrip(normalizeTrip(t));
    }
    void load();
    const id = window.setInterval(() => void load(), 1500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [tripId, nav]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void flushSyncQueue();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void flushSyncQueue();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!tripId || !trip) return null;

  const syncLabel = !online
    ? "Offline (cached data)"
    : syncEnabled()
      ? "Online (live sync)"
      : "Online (local-only)";

  return (
    <div className="trip-app">
      <div className="app-shell trip-app__inner">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1 className="title" style={{ fontSize: "1.1rem" }}>
              {trip.name}
            </h1>
            <p className="sub" style={{ margin: 0 }}>
              Code: <strong>{trip.tripCode}</strong>
            </p>
          </div>
          <div className="stack" style={{ gap: 6, alignItems: "flex-end" }}>
            <span className="badge-fx">{syncLabel}</span>
            <Link className="btn btn-ghost" to={`/trip/${tripId}/edit`}>
              Edit trip
            </Link>
          </div>
        </div>
        <MobileTripNav tripId={tripId} />
        <Outlet context={{ trip }} />
      </div>
      <FloatingAddButton tripId={tripId} />
    </div>
  );
}
