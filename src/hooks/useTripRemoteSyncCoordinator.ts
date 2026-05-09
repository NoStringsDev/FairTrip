import { useEffect } from "react";
import {
  executeTripPull,
  scheduleDebouncedTripPull,
} from "../services/tripRemotePull";
import { flushSyncQueue } from "../services/tripSync";
import { syncEnabled } from "../services/sync";

const PULL_INTERVAL_MS = 10_000;

/** Foreground pulls while a trip is open: resume, periodic when visible, and retry push on reconnect. */
export function useTripRemoteSyncCoordinator(tripCode: string | null): void {
  useEffect(() => {
    if (!tripCode || !syncEnabled()) return;

    void executeTripPull(tripCode);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        scheduleDebouncedTripPull(tripCode);
      }
    }

    function onOnline() {
      void flushSyncQueue();
      void executeTripPull(tripCode);
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      void executeTripPull(tripCode);
    }, PULL_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.clearInterval(intervalId);
    };
  }, [tripCode]);
}
