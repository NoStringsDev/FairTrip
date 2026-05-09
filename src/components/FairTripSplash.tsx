import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import splashWordmark from "../assets/branding/designed-inline-break-wordmark.svg";

/** Debounce replay so tab switches don't flash the splash constantly. */
export const SPLASH_COOLDOWN_MS = 90_000;
/** How long the splash stays readable after the wordmark is shown (ms). */
const SPLASH_HOLD_MS = 2850;

const TRIP_CHARS = ["T", "r", "i", "p"] as const;

/**
 * Matches `designed-inline-break-wordmark.svg` (viewBox 0 0 320 88): text cap ~54 units,
 * bar height 4, dot diameter 9 (r 4.5), bar ends at circle cx — trail right edge aligns with dot center.
 */
function sizesFromSplashFont(px: number): { linePx: number; dotDiamPx: number; radiusPx: number } {
  const linePx = (4 / 54) * px;
  const dotDiamPx = (9 / 54) * px;
  return { linePx, dotDiamPx, radiusPx: dotDiamPx / 2 };
}

function easeIncoming(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Dot-centre stops: start flush with bar start (+ radius); then each Trip letter centre. */
function buildPathStops(
  trailLeft: number,
  letterCenters: readonly number[],
  radiusPx: number
): number[] {
  if (letterCenters.length === 0) return [trailLeft + radiusPx];
  return [trailLeft + radiusPx, ...letterCenters];
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
  trailLeftPx: number;
  centerX: number;
  radiusPx: number;
  linePx: number;
}): void {
  const { trailEl, dotEl, trailLeftPx, centerX, radiusPx, linePx } = opts;
  const dotLeftPx = centerX - radiusPx;
  const trailW = Math.max(0, centerX - trailLeftPx);

  trailEl.style.left = `${trailLeftPx}px`;
  trailEl.style.top = `50%`;
  trailEl.style.height = `${linePx}px`;
  trailEl.style.width = `${trailW}px`;

  dotEl.style.width = `${radiusPx * 2}px`;
  dotEl.style.height = `${radiusPx * 2}px`;
  dotEl.style.transform = `translate3d(${dotLeftPx}px, -50%, 0)`;
}

export function FairTripSplash() {
  const [visible, setVisible] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const [showExactLogo, setShowExactLogo] = useState(false);
  const lastAtRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const wasHiddenRef = useRef(false);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const stackRef = useRef<HTMLDivElement | null>(null);
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
    setShowExactLogo(false);
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

    const stack = stackRef.current;
    const track = trackRef.current;
    const trail = trailRef.current;
    const dot = dotRef.current;

    const letterEls = TRIP_CHARS.map((_, idx) => letterRefs.current[idx]).filter(Boolean) as HTMLElement[];

    if (!visible || !stack || !track || !trail || !dot || letterEls.length !== TRIP_CHARS.length) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const csStack = typeof window !== "undefined" ? globalThis.getComputedStyle(stack) : null;
    const fontPxRaw = csStack ? parseFloat(csStack.fontSize) : NaN;
    const fontPx = Number.isFinite(fontPxRaw) && fontPxRaw > 0 ? fontPxRaw : 54;
    const { linePx, dotDiamPx, radiusPx } = sizesFromSplashFont(fontPx);

    track.style.height = `${Math.max(linePx, dotDiamPx) + 2}px`;

    dot.style.opacity = "1";

    const measureTrailLeftCentersRadius = (): { trailLeftPx: number; centers: number[] } => {
      const trRect = track.getBoundingClientRect();
      const stackRect = stack.getBoundingClientRect();
      /* Bar begins at combined wordmark left edge in SVG — match stack/content left vs track inset. */
      const trailLeftPx = Math.round(stackRect.left - trRect.left);
      const centers = letterEls.map((el) => {
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2 - trRect.left;
      });
      return { trailLeftPx: Math.max(0, trailLeftPx), centers };
    };

    if (reducedMotion) {
      setLettersLit(TRIP_CHARS.length);
      const { trailLeftPx, centers } = measureTrailLeftCentersRadius();
      const cxLast = centers[centers.length - 1];
      applyTrailAndDot({
        trailEl: trail,
        dotEl: dot,
        trailLeftPx,
        centerX: cxLast,
        radiusPx,
        linePx,
      });
      setShowExactLogo(true);
      return () => {};
    }

    const durationMs = 2000;

    const run = (): void => {
      const { trailLeftPx, centers } = measureTrailLeftCentersRadius();
      const stops = buildPathStops(trailLeftPx, centers, radiusPx);
      trail.style.width = "0";
      dot.style.opacity = "1";
      applyTrailAndDot({
        trailEl: trail,
        dotEl: dot,
        trailLeftPx,
        centerX: stops[0],
        radiusPx,
        linePx,
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
          trailLeftPx,
          centerX,
          radiusPx,
          linePx,
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
          setShowExactLogo(true);
        }
      };

      rafRef.current = globalThis.requestAnimationFrame(frame);
    };

    let bootAttempts = 0;
    function boot(): void {
      const { centers } = measureTrailLeftCentersRadius();
      const laidOut =
        centers.every((n) => Number.isFinite(n)) &&
        letterEls.every((el) => el.getBoundingClientRect().width > 0.5);
      bootAttempts++;
      if (!laidOut && bootAttempts < 32) {
        rafRef.current = globalThis.requestAnimationFrame(boot);
        return;
      }
      run();
    }

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
          <div
            className={`fairtrip-splash__stack${showExactLogo ? " fairtrip-splash__stack--muted" : ""}`}
            ref={stackRef}
          >
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
              <span className="fairtrip-splash__dot fairtrip-splash__dot--logo-blue" ref={dotRef} />
            </div>
          </div>
          <img
            className={`fairtrip-splash__exact-logo${showExactLogo ? " fairtrip-splash__exact-logo--on" : ""}`}
            src={splashWordmark}
            alt=""
            width={320}
            height={88}
            decoding="sync"
          />
        </div>
      </div>
    </div>
  );
}
