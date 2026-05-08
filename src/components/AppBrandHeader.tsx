import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { useMatch } from "react-router-dom";
import inlineBreakWordmark from "../assets/branding/designed-inline-break-wordmark.svg";
import { db } from "../db/database";
import { normalizeTrip } from "../lib/tripNormalize";
import { syncEnabled } from "../services/sync";
import type { Trip } from "../types";

export function AppBrandHeader() {
  const match = useMatch("/trip/:tripId/*");
  const tripId = match?.params.tripId;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    if (!tripId) {
      setTrip(null);
      return;
    }
    const subscription = liveQuery(() => db.trips.get(tripId)).subscribe((row) => {
      const next = row ? normalizeTrip(row) : null;
      setTrip((prev) => {
        if (
          prev &&
          next &&
          prev.id === next.id &&
          prev.updatedAt === next.updatedAt &&
          prev.closedAt === next.closedAt
        ) {
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

  const syncLabel = !online
    ? "Offline (cached data)"
    : syncEnabled()
      ? "Online (live sync)"
      : "Online (local-only)";
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
          <div className={`sync-status sync-status--${syncTone}`}>
            <span className="sync-status__dot" aria-hidden />
            <span>{syncLabel}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
