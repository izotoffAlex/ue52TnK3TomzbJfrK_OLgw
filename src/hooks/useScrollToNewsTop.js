// Путь: frontend/src/hooks/useScrollToNewsTop.js
// Назначение: Автоскролл к началу новости при смене новости внутри SPA.
// Почему нужно:
//   В React Router при переходе на другую новость в том же компоненте скролл НЕ сбрасывается.
// Что делает:
//   ✅ Скроллит к якорю #news-detail-top (перед заголовком новости)
//   ✅ Учитывает высоту фиксированной шапки (.navbar/header), чтобы заголовок не прятался под ней
//   ✅ Работает стабильно: ждёт отрисовку через requestAnimationFrame + повторная попытка
//   ✅ Умеет скроллить НЕ только window, но и внутренний scroll-контейнер (если у страницы overflow: auto)
//
// Как использовать:
//   1) На странице новости добавь <div id="news-detail-top" />
//   2) В NewsDetailPage вызови:
//        useScrollToNewsTop(slug || id, { behavior: "smooth" });
//      (ВАЖНО: slug/id должны реально меняться при кликах по похожим/последним)

import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

function isScrollable(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  const oy = style.overflowY;
  const canScroll = (oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight;
  return canScroll;
}

function findScrollContainer(preferredSelector) {
  // 1) Если пользователь указал селектор контейнера — используем его
  if (preferredSelector) {
    const preferred = document.querySelector(preferredSelector);
    if (preferred && typeof preferred.scrollTo === "function") return preferred;
  }

  // 2) Нормальный случай: страница скроллится через document.scrollingElement
  const se = document.scrollingElement || document.documentElement;
  if (se && se.scrollHeight > se.clientHeight) return se;

  // 3) Если window “не скроллится” (часто при layout с overflow: hidden),
  //    попробуем найти ближайший разумный scroll-root.
  //    (Ищем самый “нижний” подходящий контейнер по популярным селекторам, затем общий поиск)
  const commonSelectors = [
    "#root",
    ".App",
    ".app",
    "main",
    ".main",
    ".content",
    ".page",
    ".layout",
  ];

  for (const sel of commonSelectors) {
    const el = document.querySelector(sel);
    if (isScrollable(el)) return el;
  }

  // 4) Общий поиск: первый крупный скроллящийся элемент
  const all = Array.from(document.querySelectorAll("body *"));
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (isScrollable(el)) return el;
  }

  // 5) Фолбэк
  return se || document.documentElement;
}

function getNavbarHeight() {
  const navbar =
    document.querySelector(".navbar") ||
    document.querySelector("header") ||
    null;

  if (!navbar) return 0;
  const r = navbar.getBoundingClientRect();
  return r.height || 0;
}

function scrollToAnchor({ anchorId, extraOffset, behavior, containerSelector }) {
  const anchor = document.getElementById(anchorId);
  const container = findScrollContainer(containerSelector);

  const navbarH = getNavbarHeight();

  // Если якоря нет — просто вверх
  if (!anchor) {
    if (container === document.documentElement || container === document.body || container === document.scrollingElement) {
      window.scrollTo({ top: 0, left: 0, behavior });
    } else if (container && typeof container.scrollTo === "function") {
      container.scrollTo({ top: 0, left: 0, behavior });
    }
    return;
  }

  // Считаем позицию якоря относительно контейнера
  const aRect = anchor.getBoundingClientRect();

  // Если контейнер — документ, можно работать как с window
  const isDoc =
    container === document.documentElement ||
    container === document.body ||
    container === document.scrollingElement;

  if (isDoc) {
    const absoluteTop = window.scrollY + aRect.top;
    const targetTop = Math.max(0, absoluteTop - navbarH - extraOffset);
    window.scrollTo({ top: targetTop, left: 0, behavior });
    return;
  }

  // Контейнер внутри страницы
  const cRect = container.getBoundingClientRect();
  const relativeTop = (aRect.top - cRect.top) + container.scrollTop;
  const targetTop = Math.max(0, relativeTop - navbarH - extraOffset);
  container.scrollTo({ top: targetTop, left: 0, behavior });
}

export default function useScrollToNewsTop(triggerKey, options = {}) {
  const location = useLocation();

  const {
    anchorId = "news-detail-top",
    extraOffset = 10,
    behavior = "auto", // "auto" надёжнее при быстрых кликах, но можно "smooth"
    enabled = true,
    containerSelector = null, // если знаешь точный scroll-root — укажи селектор
    // если triggerKey случайно постоянный — хук всё равно отработает на смену маршрута
    reactToRouteChange = true,
  } = options;

  const routeKey = useMemo(() => {
    if (!reactToRouteChange) return "";
    return `${location.pathname}${location.search}${location.hash || ""}`;
  }, [location.pathname, location.search, location.hash, reactToRouteChange]);

  const finalKey = useMemo(() => {
    // Если triggerKey пришёл — он главный (так правильнее для "смены новости в том же маршруте")
    // Но если triggerKey не меняется — routeKey всё равно даст перезапуск эффекта.
    return `${String(triggerKey ?? "")}__${routeKey}`;
  }, [triggerKey, routeKey]);

  useEffect(() => {
    if (!enabled) return;

    let raf1 = 0;
    let raf2 = 0;
    let t1 = 0;

    const run = () => {
      scrollToAnchor({ anchorId, extraOffset, behavior, containerSelector });
    };

    // 1) После рендера
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => run());
    });

    // 2) Повтор через чуть-чуть — на случай тяжёлой разметки/картинок/долгой подгрузки
    t1 = window.setTimeout(() => run(), 120);

    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      if (t1) clearTimeout(t1);
    };
  }, [finalKey, anchorId, extraOffset, behavior, enabled, containerSelector]);
}
