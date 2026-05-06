import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../db/database";
import { clearLastTripId, getLastTripId, setLastTripId } from "../lib/lastTrip";
import { resolveTripByCode } from "../services/tripAccess";

export function HomeGate() {
  const nav = useNavigate();
  const [search] = useSearchParams();

  useEffect(() => {
    let alive = true;
    async function open() {
      const sharedCode = search.get("tripCode")?.trim().toUpperCase();
      if (sharedCode) {
        try {
          const trip = await resolveTripByCode(sharedCode);
          if (trip && alive) {
            setLastTripId(trip.id);
            nav(`/trip/${trip.id}/balance`, { replace: true });
            return;
          }
        } catch {
          // Fall through to welcome.
        }
        if (alive) {
          nav(`/welcome?tripCode=${encodeURIComponent(sharedCode)}&joinError=1`, {
            replace: true,
          });
        }
        return;
      }

      const lastTripId = getLastTripId();
      if (!lastTripId) {
        if (alive) nav("/welcome", { replace: true });
        return;
      }
      const trip = await db.trips.get(lastTripId);
      if (!trip) {
        clearLastTripId();
        if (alive) nav("/welcome", { replace: true });
        return;
      }
      if (alive) nav(`/trip/${trip.id}/balance`, { replace: true });
    }
    void open();
    return () => {
      alive = false;
    };
  }, [nav, search]);

  return (
    <div className="app-shell">
      <p className="sub">Opening your latest trip…</p>
    </div>
  );
}

