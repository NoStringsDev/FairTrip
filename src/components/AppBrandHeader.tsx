import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { useMatch } from "react-router-dom";
import inlineBreakWordmark from "../assets/branding/designed-inline-break-wordmark.svg";
import { db } from "../db/database";
import { useTripRemoteSyncCoordinator } from "../hooks/useTripRemoteSyncCoordinator";
import { TripPullError } from "./TripPullError";
import { TripSyncBar } from "./TripSyncBar";
import { normalizeTrip } from "../lib/tripNormalize";
import { syncEnabled } from "../services/sync";
import {
  formatPullMergeError,
  type PullMergeResult,
} from "../services/tripSync";
import type { Trip } from "../types";

function sameHeaderTrip(a: Trip, b: Trip): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.tripCode === b.tripCode &&
    a.closedAt === b.closedAt
  );
}

export function AppBrandHeader() {
  const match = useMatch("/trip/:tripId/*");
  const tripId = match?.params.tripId;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  const onPullResult = useCallback((r: PullMergeResult) => {
    if (r.ok) setPullError(null);
    else setPullError(formatPullMergeError(r));
  }, []);

  useEffect(() => {
    if (!tripId) {
      setTrip(null);
      return;
    }
    const subscription = liveQuery(() => db.trips.get(tripId)).subscribe((row) => {
      const next = row ? normalizeTrip(row) : null;
      setTrip((prev) => {
        if (prev && next && sameHeaderTrip(prev, next)) {
          return prev;
        }
        return next;
      });
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [tripId]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useTripRemoteSyncCoordinator(trip?.tripCode ?? null, onPullResult);

  const syncAriaLabel = !online
    ? "Offline — using cached data"
    : syncEnabled()
      ? "Online — syncing in background when this screen is open"
      : "Online — sync API not configured";

  const syncTone = !online ? "offline" : syncEnabled() ? "live" : "local";

  return (
    <header className="brand-header" aria-label="FairTrip brand">
      <div className="brand-header__inner">
        <img className="brand-header__wordmark" src={inlineBreakWordmark} alt="FairTrip" />
        {trip ? (
          <div className="brand-header__meta">
            <h1 className="title brand-header__trip-name">{trip.name}</h1>
            <p className="sub brand-header__trip-code">
              Code: <strong>{trip.tripCode}</strong>
            </p>
          </div>
        ) : null}
        {trip ? (
          <div className="brand-header__sync-cluster">
            <div
              className={`sync-status sync-status--${syncTone} sync-status--icon-only`}
              role="status"
              aria-label={syncAriaLabel}
              title={syncAriaLabel}
            >
              <span className="sync-status__dot" aria-hidden />
            </div>
            <TripSyncBar tripCode={trip.tripCode} onPullResult={onPullResult} />
          </div>
        ) : null}
      </div>
      {trip ? (
        <div className="brand-header__below">
          <TripPullError message={pullError} />
        </div>
      ) : null}
    </header>
  );
}
