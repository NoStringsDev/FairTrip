import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { db } from "../db/database";
import type { Trip } from "../types";
import { FloatingAddButton } from "../components/FloatingAddButton";
import { MobileTripNav } from "../components/MobileTripNav";
import { flushSyncQueue } from "../services/tripSync";
import { normalizeTrip } from "../lib/tripNormalize";
import { setLastTripId } from "../lib/lastTrip";

export function TripLayout() {
  const { tripId } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);

  useEffect(() => {
    if (!tripId) return;
    let alive = true;
    async function load() {
      const t = await db.trips.get(tripId);
      if (!alive) return;
      if (!t) nav("/welcome");
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
    if (!trip?.id) return;
    setLastTripId(trip.id);
  }, [trip?.id]);

  useEffect(() => {
    const onOnline = () => {
      void flushSyncQueue();
    };
    window.addEventListener("online", onOnline);
    void flushSyncQueue();
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!tripId || !trip) return null;

  const hideSectionToggle =
    location.pathname.endsWith("/add") || location.pathname.endsWith("/edit");

  async function shareTrip() {
    const shareUrl = new URL("/", window.location.origin);
    shareUrl.searchParams.set("tripCode", trip.tripCode);
    const text = `Join my FairTrip: ${trip.name}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `FairTrip: ${trip.name}`,
          text,
          url: shareUrl.toString(),
        });
        return;
      }
    } catch {
      // User cancelled or share failed: fallback to clipboard below.
    }
    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      alert("Trip link copied to clipboard");
    } catch {
      alert(`Share this link: ${shareUrl.toString()}`);
    }
  }

  return (
    <div className="trip-app">
      <div className="app-shell trip-app__inner">
        <details className="trip-actions">
          <summary>
            Trip actions
          </summary>
          <div className="trip-actions__menu">
            <button
              className="trip-action-btn trip-action-btn--share"
              type="button"
              onClick={() => void shareTrip()}
            >
              Share trip
            </button>
            <Link className="trip-action-btn trip-action-btn--edit" to={`/trip/${tripId}/edit`}>
              Edit trip
            </Link>
            <Link className="trip-action-btn trip-action-btn--switch" to="/welcome">
              Switch trip
            </Link>
          </div>
        </details>
        {!hideSectionToggle ? <MobileTripNav tripId={tripId} /> : null}
        <Outlet context={{ trip }} />
      </div>
      <FloatingAddButton tripId={tripId} />
    </div>
  );
}
