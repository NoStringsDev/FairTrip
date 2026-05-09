import { useEffect } from "react";
import {
  reconcileTripIfRemoteChanged,
  clearTripRevisionCache,
  executeTripPull,
  scheduleDebouncedTripPull,
} from "../services/tripRemotePull";
import { flushSyncQueue, type PullMergeResult } from "../services/tripSync";
import { syncEnabled } from "../services/sync";

/** Cheap server watermark checks while foregrounded (tiny JSON vs full sync payload). */
const REVISION_PROBE_INTERVAL_MS = 22_000;
/** Immediately pull fresh data once when switching back to app / foreground. */
const RESUME_DEBOUNCE_MS = 140;

/** Foreground sync: eager full pulls on lifecycle edges; periodic lightweight rev probe. */
export function useTripRemoteSyncCoordinator(
  tripCode: string | null,
  onPullResult?: (r: PullMergeResult) => void
): void {
  useEffect(() => {
    if (!tripCode || !syncEnabled()) return;

    void executeTripPull(tripCode).then((r) => onPullResult?.(r));

    function onResume() {
      scheduleDebouncedTripPull(tripCode, RESUME_DEBOUNCE_MS, onPullResult);
    }

    function onVisibility() {
      if (document.visibilityState === "visible") onResume();
    }

    function onPageShow() {
      if (document.visibilityState === "visible") onResume();
    }

    function onOnline() {
      void flushSyncQueue();
      void executeTripPull(tripCode).then((r) => onPullResult?.(r));
    }

    /** Small GET `/api/sync/rev` (~tens of bytes); full merge only when it changed remotely. */
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void reconcileTripIfRemoteChanged(tripCode, onPullResult);
    }, REVISION_PROBE_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onPageShow);
      window.clearInterval(intervalId);
      clearTripRevisionCache(tripCode);
    };
  }, [tripCode, onPullResult]);
}
