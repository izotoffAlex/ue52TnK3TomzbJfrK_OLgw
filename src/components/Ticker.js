// Путь: frontend/src/components/Ticker.js
// Назначение: “умная” бегущая строка для шапки IzotovLife.
// Требование:
//   ✅ Если контент НЕ помещается — плавно “бежим”
//   ✅ Если контент помещается — НИКАКОЙ бегущей строки (без дубля текста)
//   ✅ Работает на всех экранах (десктоп/мобилка)
// Надёжность:
//   ✅ Не падает, если ResizeObserver недоступен
//   ✅ Учитывает prefers-reduced-motion (анимации отключены — просто статично)
//
// Внутри рендерим ДВЕ копии детей только когда нужно “бежать”.
// Когда бег не нужен — рендерится ОДНА копия, без анимации.

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Ticker.css";

export default function Ticker({
  children,
  pauseSeconds = 0,
  speedDayPxPerSec = 80,
  speedNightPxPerSec = 55,
  epsilonPx = 8, // запас: на пару пикселей “дрожания” верстки/скроллбаров
}) {
  const trackRef = useRef(null);   // видимая область
  const contentRef = useRef(null); // двигаемый трек (когда активен)
  const copyRef = useRef(null);    // “одна копия” для измерения ширины

  const rafRef = useRef(null);
  const offsetRef = useRef(0);
  const lastTsRef = useRef(0);
  const pausedUntilRef = useRef(0);

  const cycleWRef = useRef(0); // ширина одного цикла (одной копии)
  const viewWRef = useRef(0);  // ширина видимой области

  const [viewportW, setViewportW] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  const [isActive, setIsActive] = useState(false);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  // Отслеживаем ширину окна (скорость + перерасчет)
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth || 1024);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Базовая скорость (как раньше: средняя / 2)
  const baseSpeedPxPerSec = useMemo(() => {
    const avg = (Number(speedDayPxPerSec) + Number(speedNightPxPerSec)) / 2;
    const safe = Number.isFinite(avg) ? avg : 60;
    return Math.max(10, Math.round(safe / 2));
  }, [speedDayPxPerSec, speedNightPxPerSec]);

  // Мобильное замедление (чтобы визуально было спокойно)
  const mobileMultiplier = useMemo(() => {
    if (viewportW <= 420) return 0.55;
    if (viewportW <= 768) return 0.65;
    return 1.0;
  }, [viewportW]);

  const speedPxPerSec = useMemo(() => {
    return Math.max(8, Math.round(baseSpeedPxPerSec * mobileMultiplier));
  }, [baseSpeedPxPerSec, mobileMultiplier]);

  // ===== 1) Измеряем: помещается ли контент? =====
  useEffect(() => {
    const measure = () => {
      const trackEl = trackRef.current;
      const copyEl = copyRef.current;
      if (!trackEl || !copyEl) return;

      const viewW = trackEl.clientWidth || 0;
      // scrollWidth надёжнее для inline-flex/max-content
      const cycleW = copyEl.scrollWidth || 0;

      viewWRef.current = viewW;
      cycleWRef.current = cycleW;

      // Бежим, только если действительно не помещается
      const shouldRun = !prefersReducedMotion && cycleW > viewW + epsilonPx;

      setIsActive((prev) => (prev === shouldRun ? prev : shouldRun));
    };

    measure();

    // ResizeObserver (если доступен)
    let ro = null;
    if (
      typeof window !== "undefined" &&
      typeof window.ResizeObserver !== "undefined"
    ) {
      ro = new ResizeObserver(() => measure());
      if (trackRef.current) ro.observe(trackRef.current);
      if (copyRef.current) ro.observe(copyRef.current);
    }

    // Резерв: window resize
    window.addEventListener("resize", measure, { passive: true });

    // Ещё резерв: шрифты/виджеты могут дорендериться позже
    const t1 = window.setTimeout(measure, 250);
    const t2 = window.setTimeout(measure, 1200);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [children, viewportW, prefersReducedMotion, epsilonPx]);

  // ===== 2) Анимация (только когда isActive=true) =====
  useEffect(() => {
    // если бег не нужен — сброс transform и выход
    if (!isActive) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      offsetRef.current = 0;
      lastTsRef.current = 0;

      const el = contentRef.current;
      if (el) el.style.transform = "translate3d(0,0,0)";
      return;
    }

    const contentEl = contentRef.current;
    if (!contentEl) return;

    const setX = (x) => {
      contentEl.style.transform = `translate3d(${x}px, 0, 0)`;
    };

    offsetRef.current = 0;
    lastTsRef.current = performance.now();
    pausedUntilRef.current =
      pauseSeconds > 0 ? performance.now() + pauseSeconds * 1000 : 0;

    const onVisibility = () => {
      // чтобы после возврата на вкладку dt не стал огромным
      lastTsRef.current = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const step = (ts) => {
      const cycleW = cycleWRef.current || 0;

      // На всякий: если ширина вдруг стала 0 — ждём
      if (cycleW < 10) {
        setX(0);
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      // Пауза между циклами (опционально)
      if (pauseSeconds > 0 && ts < pausedUntilRef.current) {
        lastTsRef.current = ts;
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const dt = Math.max(0, ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      offsetRef.current += speedPxPerSec * dt;

      if (offsetRef.current >= cycleW) {
        offsetRef.current = 0;
        setX(0);

        if (pauseSeconds > 0) {
          pausedUntilRef.current = ts + pauseSeconds * 1000;
        }

        rafRef.current = requestAnimationFrame(step);
        return;
      }

      setX(-offsetRef.current);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isActive, pauseSeconds, speedPxPerSec]);

  return (
    <div
      className={`ticker ${isActive ? "ticker--active" : "ticker--inactive"}`}
      aria-label="Бегущая строка"
    >
      <div className="ticker__track" ref={trackRef}>
        {isActive ? (
          <div className="ticker__content" ref={contentRef}>
            <div className="ticker__copy" ref={copyRef}>
              {children}
            </div>
            <div className="ticker__copy" aria-hidden="true">
              {children}
            </div>
          </div>
        ) : (
          <div className="ticker__static" ref={copyRef}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
