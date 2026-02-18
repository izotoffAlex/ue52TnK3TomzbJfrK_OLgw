// Путь: frontend/src/components/SmartTicker.js
// Назначение: Управляемая бегущая строка для Navbar.
// Что делает:
//   ✅ Двигается только если контент шире контейнера
//   ✅ По клику плавно возвращается в начало и делает паузу pauseOnResetMs
//   ✅ Скорость: speedDayPxPerSec/speedNightPxPerSec
//   ✅ prefers-reduced-motion: если включено, анимации нет

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./SmartTicker.css";

function nowMs() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export default function SmartTicker({
  children,
  className = "",
  speedDayPxPerSec = 50,
  speedNightPxPerSec = 35,
  dayStartHour = 8,
  nightStartHour = 23,
  resetDurationMs = 650,
  pauseOnResetMs = 2000,
  title,
}) {
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const rafRef = useRef(0);

  const [dims, setDims] = useState({ viewportW: 0, contentW: 0 });
  const [offset, setOffset] = useState(0);

  const modeRef = useRef({
    mode: "run", // "run" | "reset" | "pause"
    lastT: 0,
    pausedUntil: 0,
    resetStartT: 0,
    resetStartOffset: 0,
  });

  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  }, []);

  const getSpeedPxPerSec = useCallback(() => {
    const h = new Date().getHours();
    const isDay = h >= dayStartHour && h < nightStartHour;
    return isDay ? speedDayPxPerSec : speedNightPxPerSec;
  }, [dayStartHour, nightStartHour, speedDayPxPerSec, speedNightPxPerSec]);

  const shouldAnimate = useMemo(() => {
    return !reducedMotion && dims.contentW > 0 && dims.viewportW > 0 && dims.contentW > dims.viewportW + 2;
  }, [dims, reducedMotion]);

  const measure = useCallback(() => {
    const vp = viewportRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) return;

    const viewportW = Math.ceil(vp.getBoundingClientRect().width);
    const contentW = Math.ceil(ct.getBoundingClientRect().width);

    setDims((prev) => {
      if (prev.viewportW === viewportW && prev.contentW === contentW) return prev;
      return { viewportW, contentW };
    });
  }, []);

  useLayoutEffect(() => {
    measure();

    let ro;
    if (typeof window !== "undefined" && window.ResizeObserver) {
      ro = new ResizeObserver(() => measure());
      if (viewportRef.current) ro.observe(viewportRef.current);
      if (contentRef.current) ro.observe(contentRef.current);
    }

    window.addEventListener("resize", measure);

    return () => {
      window.removeEventListener("resize", measure);
      if (ro) ro.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    if (!shouldAnimate) {
      setOffset(0);
      modeRef.current.mode = "run";
      modeRef.current.pausedUntil = 0;
    }
  }, [shouldAnimate]);

  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);

    if (!shouldAnimate) return;

    const t = nowMs();
    const st = modeRef.current;

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(64, t - st.lastT);
    st.lastT = t;

    if (st.mode === "pause") {
      if (t >= st.pausedUntil) st.mode = "run";
      else return;
    }

    if (st.mode === "reset") {
      const elapsed = t - st.resetStartT;
      const p = Math.max(0, Math.min(1, elapsed / Math.max(1, resetDurationMs)));
      const k = easeOutCubic(p);

      const next = st.resetStartOffset * (1 - k);
      setOffset(next);

      if (p >= 1) {
        setOffset(0);
        st.mode = "pause";
        st.pausedUntil = t + pauseOnResetMs;
      }
      return;
    }

    const speed = getSpeedPxPerSec();
    const step = (speed * dt) / 1000;

    setOffset((prev) => {
      let next = prev + step;
      if (dims.contentW > 0 && next >= dims.contentW) next -= dims.contentW;
      return next;
    });
  }, [shouldAnimate, dims.contentW, getSpeedPxPerSec, pauseOnResetMs, resetDurationMs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [tick]);

  const handleReset = useCallback(() => {
    if (!shouldAnimate) return;

    const st = modeRef.current;
    const t = nowMs();

    if (st.mode === "pause") {
      st.pausedUntil = t + pauseOnResetMs;
      setOffset(0);
      return;
    }

    st.mode = "reset";
    st.resetStartT = t;
    st.resetStartOffset = offset;
  }, [offset, pauseOnResetMs, shouldAnimate]);

  return (
    <div
      className={`smartTicker ${className}`.trim()}
      ref={viewportRef}
      title={title}
      role="button"
      tabIndex={0}
      onClick={handleReset}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleReset();
        }
      }}
    >
      <div
        className="smartTicker__track"
        style={{ transform: shouldAnimate ? `translateX(-${offset}px)` : "translateX(0px)" }}
      >
        <div className="smartTicker__content" ref={contentRef}>
          {children}
        </div>

        {shouldAnimate && (
          <div className="smartTicker__content" aria-hidden="true">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
