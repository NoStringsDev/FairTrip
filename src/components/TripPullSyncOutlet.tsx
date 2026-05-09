import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { executeTripPull } from "../services/tripRemotePull";
import type { PullMergeResult } from "../services/tripSync";
import { syncEnabled } from "../services/sync";

const RELEASE_PULL_DY_PX = 36;
const TOUCH_RESISTANCE = 0.45;

type Props = {
  tripCode: string;
  children: ReactNode;
  onPullResult?: (r: PullMergeResult) => void;
};

/** Scroll region with touch pull-to-sync (visual indicator only). */
export function TripPullSyncOutlet({ tripCode, children, onPullResult }: Props) {
  const scrollEl = useRef<HTMLDivElement>(null);
  const [pullDy, setPullDy] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncOn = syncEnabled();

  const touchStartY = useRef(0);
  const touchPulling = useRef(false);
  const maxPullDy = useRef(0);

  const runPull = useCallback(async () => {
    if (!syncOn) return;
    setSyncing(true);
    try {
      const r = await executeTripPull(tripCode);
      onPullResult?.(r);
    } finally {
      setSyncing(false);
    }
  }, [tripCode, syncOn, onPullResult]);

  useEffect(() => {
    const el = scrollEl.current;
    if (!el || !syncOn) return;

    function onTouchStart(e: TouchEvent) {
      if (el.scrollTop > 2) return;
      const t = e.touches[0];
      touchStartY.current = t.clientY;
      touchPulling.current = false;
      maxPullDy.current = 0;
    }

    function onTouchMove(e: TouchEvent) {
      if (el.scrollTop > 2) {
        setPullDy(0);
        touchPulling.current = false;
        return;
      }
      const t = e.touches[0];
      const dy = t.clientY - touchStartY.current;
      if (dy > 6) {
        touchPulling.current = true;
        const resisted = Math.min(dy * TOUCH_RESISTANCE, 88);
        maxPullDy.current = Math.max(maxPullDy.current, resisted);
        setPullDy(resisted);
        e.preventDefault();
      }
    }

    function onTouchEnd() {
      setPullDy(0);
      const shouldSync =
        touchPulling.current && maxPullDy.current >= RELEASE_PULL_DY_PX && el.scrollTop <= 2;
      touchPulling.current = false;
      maxPullDy.current = 0;
      if (shouldSync) void runPull();
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [syncOn, runPull]);

  const showGlow = syncing || pullDy > 4;
  const progress = syncing ? 1 : Math.min(pullDy / RELEASE_PULL_DY_PX, 1);

  return (
    <div ref={scrollEl} className="trip-pull-sync">
      <div
        className={`trip-pull-sync__rail${showGlow ? " trip-pull-sync__rail--active" : ""}`}
        aria-hidden
      >
        <span
          className="trip-pull-sync__spinner-wrap"
          style={{
            opacity: showGlow ? 0.95 : 0,
            transform: `translateY(${Math.min(pullDy * 0.35, 22)}px) scale(${0.55 + progress * 0.45})`,
          }}
        >
          <span
            className={`trip-pull-sync__spinner${syncing ? " trip-pull-sync__spinner--spin" : ""}`}
          />
        </span>
      </div>
      <div className="trip-pull-sync__content">{children}</div>
    </div>
  );
}
