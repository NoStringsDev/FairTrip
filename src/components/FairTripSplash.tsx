import { useCallback, useEffect, useRef, useState } from "react";

/** Debounce replay so tab switches don't flash the splash constantly. */
export const SPLASH_COOLDOWN_MS = 90_000;
/** How long the splash stays readable before fading out. */
const SPLASH_HOLD_MS = 2150;

/**
 * Opening / resume branded splash: "Fair", pink line + blue dot crawl, then "Trip".
 */
export function FairTripSplash() {
  const [visible, setVisible] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const lastAtRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const wasHiddenRef = useRef(false);

  const clearHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const playSplash = useCallback((force: boolean) => {
    const now = Date.now();
    if (!force && now - lastAtRef.current < SPLASH_COOLDOWN_MS) return;
    clearHide();
    lastAtRef.current = now;
    setReplayKey((k) => k + 1);
    setVisible(true);
    hideTimerRef.current = globalThis.setTimeout(() => {
      setVisible(false);
      hideTimerRef.current = null;
    }, SPLASH_HOLD_MS);
  }, [clearHide]);

  useEffect(() => {
    playSplash(true);
    return () => {
      clearHide();
    };
  }, [clearHide, playSplash]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
        return;
      }
      if (document.visibilityState === "visible" && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        playSplash(false);
      }
    }
    function onPageShow(e: PageTransitionEvent) {
      /* Back-forward cache restores may not toggle visibility alone. */
      if (e.persisted) playSplash(false);
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [playSplash]);

  return (
    <div
      className={`fairtrip-splash${visible ? " fairtrip-splash--visible" : ""}`}
      aria-hidden={!visible}
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      <div key={replayKey} className="fairtrip-splash__scene">
        <div className="fairtrip-splash__word-row" aria-hidden>
          <span className="fairtrip-splash__fair">Fair</span>
          <span className="fairtrip-splash__trip">Trip</span>
        </div>
        <div className="fairtrip-splash__track" aria-hidden>
          <span className="fairtrip-splash__line" />
          <span className="fairtrip-splash__dot" />
        </div>
      </div>
    </div>
  );
}
