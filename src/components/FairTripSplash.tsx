import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Debounce replay so tab switches don't flash the splash constantly. */
export const SPLASH_COOLDOWN_MS = 90_000;
/** ~33% faster than prior 1680ms (same feel, shorter hold). */
const WIPE_DURATION_MS = 1120;

/** Time splash stays on screen after wipe/dot motion ends (was ~1730ms from 2850 − 1120). */
const SPLASH_TAIL_MS = 865;

/** Total overlay time = motion + tail before fade. */
const SPLASH_HOLD_MS = WIPE_DURATION_MS + SPLASH_TAIL_MS;

/**
 * Matches `designed-inline-break-wordmark.svg` (viewBox 0 0 320 88): text cap ~54 units,
 * bar height 4, dot diameter 9 (r 4.5), bar ends at circle cx — trail right edge aligns with dot center.
 */
function sizesFromSplashFont(px: number): { linePx: number; dotDiamPx: number; radiusPx: number } {
  const linePx = (4 / 54) * px;
  const dotDiamPx = (9 / 54) * px;
  return { linePx, dotDiamPx, radiusPx: dotDiamPx / 2 };
}

/** Horizontal centre of the final ‘p’ in “Trip” (one text run = correct kerning). */
function measurePCenterX(tripEl: HTMLElement, trRect: DOMRect): number | null {
  const child = tripEl.firstChild;
  if (!child || child.nodeType !== Node.TEXT_NODE) return null;
  const text = child.textContent ?? "";
  if (text.length < 4) return null;
  try {
    const range = document.createRange();
    range.setStart(child, 3);
    range.setEnd(child, 4);
    const br = range.getBoundingClientRect();
    if (br.width === 0 && br.height === 0) return null;
    return br.left + br.width / 2 - trRect.left;
  } catch {
    return null;
  }
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

function applyWordWipe(wordClipEl: HTMLElement, u: number): void {
  const p = Math.min(1, Math.max(0, u));
  wordClipEl.style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`;
}

export function FairTripSplash() {
  const [visible, setVisible] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const lastAtRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const wasHiddenRef = useRef(false);
  const tripTextRef = useRef<HTMLSpanElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const wordClipRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const trailRef = useRef<HTMLSpanElement | null>(null);
  const dotRef = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef<number | null>(null);

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
    const wordClip = wordClipRef.current;
    const track = trackRef.current;
    const trail = trailRef.current;
    const dot = dotRef.current;
    const tripEl = tripTextRef.current;

    if (!visible || !stack || !wordClip || !track || !trail || !dot || !tripEl) return;

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

    const measureGeometry = (): { trailLeftPx: number; startCx: number; endCx: number } => {
      const trRect = track.getBoundingClientRect();
      const wcRect = wordClip.getBoundingClientRect();
      const trailLeftPx = Math.max(0, Math.round(wcRect.left - trRect.left));
      const endFromGlyph = measurePCenterX(tripEl, trRect);
      const endCx = endFromGlyph ?? NaN;
      const startCx = trailLeftPx + radiusPx;
      return { trailLeftPx, startCx, endCx };
    };

    if (reducedMotion) {
      const { trailLeftPx, startCx, endCx } = measureGeometry();
      const cx = Number.isFinite(endCx) ? endCx : startCx + 80;
      applyTrailAndDot({
        trailEl: trail,
        dotEl: dot,
        trailLeftPx,
        centerX: cx,
        radiusPx,
        linePx,
      });
      applyWordWipe(wordClip, 1);
      wordClip.style.willChange = "auto";
      return () => {};
    }

    const run = (): void => {
      const { trailLeftPx, startCx, endCx } = measureGeometry();

      let cx1 = endCx;
      if (!Number.isFinite(cx1) || cx1 <= startCx + 8) {
        cx1 = startCx + wcFallbackSpan(wordClip);
      }

      const cx0 = startCx;

      trail.style.width = "0";
      dot.style.opacity = "1";

      wordClip.style.willChange = "clip-path";
      applyWordWipe(wordClip, 0);
      applyTrailAndDot({
        trailEl: trail,
        dotEl: dot,
        trailLeftPx,
        centerX: cx0,
        radiusPx,
        linePx,
      });

      const t0 = performance.now();

      const frame = (): void => {
        const now = performance.now();
        const u = Math.min(1, (now - t0) / WIPE_DURATION_MS);
        const centerX = cx0 + u * (cx1 - cx0);

        applyTrailAndDot({
          trailEl: trail,
          dotEl: dot,
          trailLeftPx,
          centerX,
          radiusPx,
          linePx,
        });
        applyWordWipe(wordClip, u);

        if (u < 1) {
          rafRef.current = globalThis.requestAnimationFrame(frame);
        } else {
          rafRef.current = null;
          wordClip.style.willChange = "auto";
          applyWordWipe(wordClip, 1);
        }
      };

      rafRef.current = globalThis.requestAnimationFrame(frame);
    };

    function wcFallbackSpan(wcEl: HTMLElement): number {
      const a = wcEl.getBoundingClientRect().width;
      return Math.min(a * 0.62, Math.max(a * 0.45, 64));
    }

    let bootAttempts = 0;
    function boot(): void {
      const laidOut = tripEl.getBoundingClientRect().width > 1;
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
    // replayKey rewires subtree
  }, [cancelAnim, replayKey, visible]);

  return (
    <div
      className={`fairtrip-splash${visible ? " fairtrip-splash--visible" : ""}`}
      aria-hidden={!visible}
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      <div key={replayKey} className="fairtrip-splash__scene">
        <div className="fairtrip-splash__brand">
          <div className="fairtrip-splash__stack" ref={stackRef}>
            <div className="fairtrip-splash__word-clip" ref={wordClipRef}>
              <div className="fairtrip-splash__word-row" aria-hidden>
                <span>Fair</span><span ref={tripTextRef} className="fairtrip-splash__trip">Trip</span>
              </div>
            </div>
            <div className="fairtrip-splash__track" ref={trackRef} aria-hidden>
              <span className="fairtrip-splash__line" ref={trailRef} />
              <span className="fairtrip-splash__dot fairtrip-splash__dot--logo-blue" ref={dotRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
