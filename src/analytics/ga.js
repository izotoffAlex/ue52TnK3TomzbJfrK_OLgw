// Путь: frontend/src/analytics/ga.js
// Назначение: GA4 helper для IzotovLife (React SPA).
// Важно:
//   - В index.html (внутри <head>) должен быть подключён Google tag (gtag.js) с ID G-S04DMRLPHY.
//   - Этот файл НЕ вставляет gtag в HTML, он только пользуется window.gtag.
//   - Любые ошибки аналитики НЕ должны ломать сайт.

export const GA_MEASUREMENT_ID = "G-S04DMRLPHY";

function hasGtag() {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

export function gaPageView(pathnameWithSearch) {
  try {
    if (!hasGtag()) return;

    const pagePath =
      pathnameWithSearch || window.location.pathname + window.location.search;

    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
    });
  } catch (e) {}
}

export function gaEvent(action, params = {}) {
  try {
    if (!hasGtag()) return;
    window.gtag("event", action, params);
  } catch (e) {}
}
