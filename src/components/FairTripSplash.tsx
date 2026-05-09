import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Debounce replay so tab switches don't flash the splash constantly. */
export const SPLASH_COOLDOWN_MS = 90_000;
/** How long the splash stays readable before fading out (after trail animation). */
const SPLASH_HOLD_MS = 2850;

const TRIP_CHARS = ["T", "r", "i", "p"] as const;

const DOT_DIAM_PX = 14;
const DOT_RADIUS_PX = DOT_DIAM_PX / 2;

/** Matches prior splash motion (approx. Material standard). */
function easeIncoming(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Build dot-center stops: trail start hugging left; then centre of each Trip letter. */
function buildPathStops(letterCenters: readonly number[]): number[] {
  if (letterCenters.length === 0) return [DOT_RADIUS_PX];
  return [DOT_RADIUS_PX, ...letterCenters];
}

function positionAlongPath(points: readonly number[], t: number): number {
  const nSeg = Math.max(points.length - 1, 1);
  const u = t * nSeg;
  const si = Math.min(nSeg - 1, Math.floor(u));
  const ltRaw = Math.min(Math.max(u - si, 0), 1);
  const lt = easeIncoming(ltRaw);
  const a = points[si];
  const b = points[Math.min(si + 1, points.length - 1)];
  return a + (b - a) * lt;
}

function applyTrailAndDot(opts: {
  trailEl: HTMLElement;
  dotEl: HTMLElement;
  centerX: number;
}): void {
  const dotLeft = centerX - DOT_RADIUS_PX;
  const trailWidth = Math.max(0, dotLeft);

  opts.trailEl.style.width = `${trailWidth}px`;
  opts.dotEl.style.transform = `translate3d(${dotLeft}px, -50%, 0)`;
}

export function FairTripSplash() {
  const [visible, setVisible] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const lastAtRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const wasHiddenRef = useRef(false);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const trailRef = useRef<HTMLSpanElement | null>(null);
  const dotRef = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [lettersLit, setLettersLit] = useState(0);

  const clearHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const cancelAnim = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const playSplash = useCallback((force: boolean) => {
    const now = Date.now();
    if (!force && now - lastAtRef.current < SPLASH_COOLDOWN_MS) return;
    clearHide();
    lastAtRef.current = now;
    setLettersLit(0);
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
      cancelAnim();
    };
  }, [cancelAnim, clearHide, playSplash]);

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
      if (e.persisted) playSplash(false);
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [playSplash]);

  useLayoutEffect(() => {
    cancelAnim();

    const track = trackRef.current;
    const trail = trailRef.current;
    const dot = dotRef.current;

    const letterEls = TRIP_CHARS.map((_, idx) => letterRefs.current[idx]).filter(Boolean) as HTMLElement[];

    if (!visible || !track || !trail || !dot || letterEls.length !== TRIP_CHARS.length) return;

    const measureCenters = (): number[] => {
      const trRect = track.getBoundingClientRect();
      return letterEls.map((el) => {
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2 - trRect.left;
      });
    };

    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      setLettersLit(TRIP_CHARS.length);
      const rects = letterEls.map((el) => el.getBoundingClientRect());
      const tr = track.getBoundingClientRect();
      const cxLast =
        rects[rects.length - 1].left + rects[rects.length - 1].width / 2 - tr.left;
      applyTrailAndDot({
        trailEl: trail,
        dotEl: dot,
        centerX: cxLast,
      });
      return () => {};
    }

    const durationMs = 2000;

    const run = (): void => {
      const stops = buildPathStops(measureCenters());
      trail.style.width = "0";
      dot.style.opacity = "1";
      applyTrailAndDot({
        trailEl: trail,
        dotEl: dot,
        centerX: stops[0],
      });

      const t0 = performance.now();
      let prevLit = 0;

      const frame = (): void => {
        const now = performance.now();
        const pr = Math.min(1, (now - t0) / durationMs);
        const centerX = positionAlongPath(stops, pr);

        applyTrailAndDot({
          trailEl: trail,
          dotEl: dot,
          centerX,
        });

        let nextLit = 0;
        for (let ki = 0; ki < TRIP_CHARS.length; ki++) {
          if (centerX >= stops[ki + 1] - 0.5) nextLit = ki + 1;
        }
        if (nextLit !== prevLit) {
          prevLit = nextLit;
          setLettersLit(nextLit);
        }

        if (pr < 1) {
          rafRef.current = globalThis.requestAnimationFrame(frame);
        } else {
          rafRef.current = null;
          setLettersLit(TRIP_CHARS.length);
        }
      };

      rafRef.current = globalThis.requestAnimationFrame(frame);
    };

    let bootAttempts = 0;
    function boot(): void {
      const cs = measureCenters();
      const laidOut =
        cs.every((n) => Number.isFinite(n)) &&
        letterEls.every((el) => el.getBoundingClientRect().width > 0.5);
      bootAttempts++;
      if (!laidOut && bootAttempts < 32) {
        rafRef.current = globalThis.requestAnimationFrame(boot);
        return;
      }
      run();
    }

    /* Let layout/fonts settle — measure after at least one frame. */
    rafRef.current = globalThis.requestAnimationFrame(boot);

    return () => {
      cancelAnim();
    };
  }, [cancelAnim, replayKey, visible]);

  return (
    <div
      className={`fairtrip-splash${visible ? " fairtrip-splash--visible" : ""}`}
      aria-hidden={!visible}
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      <div key={replayKey} className="fairtrip-splash__scene">
        <div className="fairtrip-splash__brand">
          <div className="fairtrip-splash__word-row" aria-hidden>
            <span className="fairtrip-splash__fair">Fair</span>
            <span className="fairtrip-splash__trip">
              {TRIP_CHARS.map((ch, idx) => (
                <span
                  key={`${replayKey}-${idx}`}
                  ref={(el) => {
                    letterRefs.current[idx] = el;
                  }}
                  className={`fairtrip-splash__trip-letter${lettersLit > idx ? " fairtrip-splash__trip-letter--on" : ""}`}
                  aria-hidden
                >
                  {ch}
                </span>
              ))}
            </span>
          </div>
          <div className="fairtrip-splash__track" ref={trackRef} aria-hidden>
            <span className="fairtrip-splash__line" ref={trailRef} />
            <span className="fairtrip-splash__dot" ref={dotRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
