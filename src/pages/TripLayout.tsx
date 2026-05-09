import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { db } from "../db/database";
import type { Trip } from "../types";
import { FloatingAddButton } from "../components/FloatingAddButton";
import { MobileTripNav } from "../components/MobileTripNav";
import { flushSyncQueue } from "../services/tripSync";
import { normalizeTrip } from "../lib/tripNormalize";
import { setLastTripId } from "../lib/lastTrip";

function sameTripUiState(a: Trip, b: Trip): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.tripCode === b.tripCode &&
    a.closedAt === b.closedAt &&
    a.tripNotes === b.tripNotes &&
    a.participantCount === b.participantCount &&
    JSON.stringify(a.entities) === JSON.stringify(b.entities) &&
    JSON.stringify(a.supportedCurrencies) === JSON.stringify(b.supportedCurrencies)
  );
}

export function TripLayout() {
  const { tripId } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tripLookupState, setTripLookupState] = useState<"loading" | "missing" | "ready">(
    "loading"
  );

  useEffect(() => {
    if (!tripId) return;
    setTripLookupState("loading");
    const subscription = liveQuery(() => db.trips.get(tripId)).subscribe((t) => {
      if (!t) {
        setTrip(null);
        setTripLookupState("missing");
        return;
      }
      const normalized = normalizeTrip(t);
      setTrip((prev) => {
        if (prev && sameTripUiState(prev, normalized)) {
          return prev;
        }
        return normalized;
      });
      setTripLookupState("ready");
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [tripId]);

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

  if (!tripId) return null;

  if (!trip || tripLookupState !== "ready") {
    return (
      <div className="trip-app">
        <div className="app-shell trip-app__inner">
          <div className="card stack">
            <p style={{ margin: 0 }}>
              {tripLookupState === "missing"
                ? "This trip is not available on this device yet."
                : "Opening trip…"}
            </p>
            {tripLookupState === "missing" ? (
              <button className="btn btn-secondary" type="button" onClick={() => nav("/welcome")}>
                Go to Welcome
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const hideSectionToggle =
    location.pathname.endsWith("/add") || location.pathname.endsWith("/edit");

  async function shareTrip() {
    const shareUrl = new URL("/", window.location.origin);
    shareUrl.searchParams.set("tripCode", trip.tripCode);
    const title = `${trip.name} on FairTrip`;
    const text = `You've got an invite! Join "${trip.name}" on FairTrip and we'll split costs fairly together. Tap the link — it only takes a moment.`;
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text,
          url: shareUrl.toString(),
        });
        return;
      }
    } catch {
      // User cancelled or share failed: fallback to clipboard below.
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${shareUrl.toString()}`);
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
