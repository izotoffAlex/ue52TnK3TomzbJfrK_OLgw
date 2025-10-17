// Путь: frontend/src/utils/imageUrl.js
// Назначение: Нормализует внешние URL (убирает вложенные прокси) и строит ссылку на /api/news/media/thumbnail/
// с параметрами src, w, h, fit, fmt, q. Плюс генерация srcset для списка ширин и aspectRatio.

const API_BASE =
  (process.env.REACT_APP_API_BASE || "http://localhost:8000/api").replace(/\/+$/, "");

// ВАЖНО: так как ресайзер смонтирован внутри news.urls как "media/thumbnail/",
// итоговый путь — /api/news/media/thumbnail/
const THUMB_ENDPOINT = `${API_BASE}/news/media/thumbnail/`;

/** Удаляем популярные «двойные прокси» — images.weserv.nl?url=... и лишние кодирования */
export function normalizeImageUrl(original) {
  if (!original) return "";
  let url = String(original).trim();
  if (/^(data:|file:)/i.test(url)) return url;

  // Расковыриваем weserv
  try {
    const rx = /https?:\/\/images\.weserv\.nl\/\?url=([^&]+)/i;
    const m = rx.exec(url);
    if (m && m[1]) url = decodeURIComponent(m[1]);
  } catch {}

  try {
    const pass = decodeURIComponent(url);
    if (pass !== url) url = pass;
  } catch {}

  return url;
}

/** Один URL для конкретной ширины+высоты */
export function buildThumbUrl(src, { w, h, fit = "cover", fmt = "webp", q = 82 } = {}) {
  const clean = normalizeImageUrl(src);
  if (!clean) return "";
  const usp = new URLSearchParams();
  usp.set("src", clean);
  usp.set("w", String(w));
  usp.set("h", String(h));
  usp.set("fit", fit);
  usp.set("fmt", fmt);
  usp.set("q", String(q));
  return `${THUMB_ENDPOINT}?${usp.toString()}`;
}

/** Строим src и srcSet из ширин и aspectRatio */
export function buildThumbSet(src, {
  widths = [320, 480, 640, 768, 1024, 1280, 1600],
  aspectRatio = 16 / 9,
  fit = "cover",
  fmt = "webp",
  q = 82,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 900px",
} = {}) {
  const heights = widths.map(w => Math.max(1, Math.round(w / (aspectRatio || (16 / 9)))));
  const mid = Math.floor(widths.length / 2);
  const srcUrl = buildThumbUrl(src, { w: widths[mid], h: heights[mid], fit, fmt, q });
  const srcSet = widths
    .map((w, i) => `${buildThumbUrl(src, { w, h: heights[i], fit, fmt, q })} ${w}w`)
    .join(", ");
  return { src: srcUrl, srcSet, sizes };
}
