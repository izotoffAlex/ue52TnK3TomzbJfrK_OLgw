// Путь: frontend/src/utils/linkBuilders.js
// Назначение: Единое место генерации внутренних ссылок на детальные страницы.
// Используйте в карточках ленты/поиска/«Похожие», чтобы избежать «кривых» URL.
//
// Как использовать (пример):
//   import { buildDetailLink } from "../utils/linkBuilders";
//   const href = buildDetailLink(item); // вернёт /news/i/:slug для RSS или /news/:category/:slug для авторской

export function buildDetailLink(item) {
  if (!item) return "#";
// Путь: frontend/src/utils/linkBuilders.js
// Назначение: Единое место генерации внутренних ссылок на детальные страницы.
// Используйте в карточках ленты/поиска/«Похожие», чтобы избежать «кривых» URL.
//
// Как использовать (пример):
//   import { buildDetailLink } from "../utils/linkBuilders";
//   const href = buildDetailLink(item);
//
// ----------------------------------------------------------------------------
// FIX 2026-02-09 (REAL CATEGORY URLS; sitemap has NO /news/<slug>/):
// ✅ Факт: в sitemap.xml отсутствуют ссылки вида /news/<slug>/.
// ✅ Значит «реальные» детальные URL должны идти:
//    1) из item.seo_url (если есть)
//    2) иначе как /<category>/<slug>/  (категорийный SEO-путь)
// ✅ При этом мы НЕ ломаем старые/служебные маршруты:
//    - для RSS/импорта оставляем /news/i/<slug> (если у тебя это реально задействовано)
//    - старый формат /news/<category>/<slug> оставляем как самый крайний fallback
//
// Важно: этот файл НЕ трогает API (/api/news/...), он только строит URL для SPA/роутинга.
// ----------------------------------------------------------------------------

export function normalizeAppPath(path) {
  // Гарантируем ведущий слэш и завершающий слэш (чтобы роутинг/каноникал был стабильнее)
  try {
    const s = String(path || "").trim();
    if (!s) return "/";

    // если это абсолютный URL (http/https) — оставим как есть
    if (/^https?:\/\//i.test(s)) return s;

    const withSlash = s.startsWith("/") ? s : `/${s}`;
    return withSlash.endsWith("/") ? withSlash : `${withSlash}/`;
  } catch {
    return "/";
  }
}

export function pickCategorySlug(item) {
  // Поддерживаем разные форматы, которые может отдавать backend
  try {
    const c1 = item?.category?.slug;
    if (c1) return String(c1).trim();
  } catch {}

  try {
    const c2 = item?.category_slug;
    if (c2) return String(c2).trim();
  } catch {}

  try {
    const c3 = item?.category;
    if (typeof c3 === "string" && c3.trim()) return c3.trim();
  } catch {}

  try {
    const c4 = item?.categories?.[0]?.slug; // legacy
    if (c4) return String(c4).trim();
  } catch {}

  return "";
}

export function pickDetailSlug(item) {
  // slug: сначала slug, потом seo_slug, потом id (как было), но в виде строки
  try {
    const v = item?.slug || item?.seo_slug || item?.news_slug || item?.article_slug || item?.id || "";
    const s = String(v || "").trim();
    return s;
  } catch {
    return "";
  }
}

// ВАЖНО: оставляем детект RSS/импорт как был (чтобы не ломать старые редиректы /news/i/*)
export function isImportedOrRssItem(item) {
  try {
    return (
      item?.type === "rss" ||
      item?.is_imported ||
      (!!item?.link && !item?.content)
    );
  } catch {
    return false;
  }
}

export function buildDetailLink(item) {
  if (!item) return "#";

  // 1) Если backend отдал SEO-URL — это истина
  try {
    const seo = String(item.seo_url || "").trim();
    if (seo) return normalizeAppPath(seo);
  } catch {}

  const slug = pickDetailSlug(item);
  if (!slug) return "#";

  const imported = isImportedOrRssItem(item);

  // 2) Legacy для импорт/RSS — оставляем, если у тебя реально используется /news/i/:slug
  //    (у тебя есть RssRedirect/LegacyRedirect/ImportedRedirect — значит это важно не ломать)
  if (imported) {
    return normalizeAppPath(`/news/i/${slug}`);
  }

  // 3) Новый правильный путь для “обычных” материалов: /<category>/<slug>/
  //    Потому что sitemap не содержит /news/<slug>/ и SEO-страницы живут в категориях.
  const categorySlug = pickCategorySlug(item);
  if (categorySlug) {
    return normalizeAppPath(`/${categorySlug}/${slug}`);
  }

  // 4) Крайний fallback (на случай очень старых данных без категории)
  //    Оставляем старую логику, но как «последнюю линию обороны».
  return normalizeAppPath(`/news/${slug}`);
}
