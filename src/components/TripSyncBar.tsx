import { useCallback, useState } from "react";
import { useOnline } from "../hooks/useOnline";
import { executeTripPull } from "../services/tripRemotePull";
import { syncEnabled } from "../services/sync";
import type { PullMergeResult } from "../services/tripSync";

type Props = {
  tripCode: string;
  onPullResult: (r: PullMergeResult) => void;
};

/** Icon-only manual sync for desktop / non-touch (shared single-flight executeTripPull). */
export function TripSyncBar({ tripCode, onPullResult }: Props) {
  const [busy, setBusy] = useState(false);
  const canSync = syncEnabled();
  const online = useOnline();

  const onClick = useCallback(async () => {
    if (!canSync || busy) return;
    setBusy(true);
    try {
      const r = await executeTripPull(tripCode);
      onPullResult(r);
    } finally {
      setBusy(false);
    }
  }, [tripCode, busy, canSync, onPullResult]);

  if (!canSync) return null;

  return (
    <div className="trip-sync-bar">
      <button
        type="button"
        className={`trip-sync-bar__btn${busy ? " trip-sync-bar__btn--busy" : ""}${!online ? " trip-sync-bar__btn--maybe-offline" : ""}`}
        onClick={() => void onClick()}
        disabled={busy}
        aria-label="Sync now"
        title={online ? undefined : "You appear offline; tap to try anyway"}
      >
        <svg
          className="trip-sync-bar__icon"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 16h5v5" />
        </svg>
      </button>
    </div>
  );
}
