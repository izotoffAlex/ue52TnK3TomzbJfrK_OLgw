// frontend/src/api/related.js
// Назначение: Клиент для универсального эндпойнта похожих новостей.
// Что внутри:
//   • fetchRelatedUniversal(slug, limit=8) — стучится на /api/news/related/<slug>/
//   • buildThumb(src, {w,h,fit,fmt,q}) — собирает абсолютный URL на наш бэкендовый прокси миниатюры
//   • absoluteMedia(pathOrUrl) — гарантирует адрес с портом 8000 (чтобы не было запросов на :3001)
//
// Ничего не ломает из вашего существующего Api.js. Этот модуль — добавка.

import axios from "axios/dist/browser/axios.cjs";

const API_BASE = "http://localhost:8000/api";

// Всегда строим абсолютный URL к back-end, чтобы не улетать на :3001
export function absoluteMedia(urlOrPath) {
  if (!urlOrPath) return null;
  try {
    // Уже абсолютный URL
    const u = new URL(urlOrPath);
    return u.href;
  } catch {
    // Относительный путь ("/media/..." или "media/...") -> пришиваем к :8000
    const path = urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`;
    return `http://localhost:8000${path}`;
  }
}

export function buildThumb(src, { w = 800, h = 450, fit = "cover", fmt = "webp", q = 82 } = {}) {
  if (!src) return null;
  const params = new URLSearchParams({
    src,
    w: String(w),
    h: String(h),
    fit,
    fmt,
    q: String(q),
  });
  return `${API_BASE}/media/thumbnail/?${params.toString()}`;
}

export async function fetchRelatedUniversal(slug, limit = 8) {
  if (!slug) return [];
  try {
    const url = `${API_BASE}/news/related/${encodeURIComponent(slug)}/?limit=${limit}`;
    const { data } = await axios.get(url);
    const items = Array.isArray(data?.items) ? data.items : [];

    // нормализуем картинки: абсолютные ссылки + миниатюры
    return items.map((it) => {
      const original = it.image ? absoluteMedia(it.image) : null;
      return {
        ...it,
        image: original,
        thumb: original ? buildThumb(original, { w: 640, h: 360, fit: "cover", fmt: "webp", q: 82 }) : null,
      };
    });
  } catch (e) {
    // 404 или любая ошибка — тихо возвращаем пустой список,
    // чтобы блок «Похожие» просто не отображался.
    return [];
  }
}
