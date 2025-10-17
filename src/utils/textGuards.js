// frontend/src/utils/textGuards.js
// Назначение: Универсальные проверки для новостей на фронтенде.
// Содержимое:
//  • extractPlainText(html) — очистка HTML (вырезает теги, NBSP) → текст.
//  • hasTextStrict(item, {minChars, minWords}) — строгая проверка наличия текста.
//  • hasValidImage(item) — есть ли нормальная картинка (не заглушка).
//  • buildInternalHref(item) — безопасный внутренний URL на детальную.
// Путь: frontend/src/utils/textGuards.js

const PLACEHOLDER_SUBSTRINGS = ["default_news.svg", "/static/img/default_news.svg"];

export function extractPlainText(html) {
  if (!html || typeof html !== "string") return "";
  const el = document.createElement("div");
  el.innerHTML = html;
  const text = (el.textContent || el.innerText || "").replace(/\u00A0/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

export function hasTextStrict(item, opts = {}) {
  const { minChars = 1, minWords = 1 } = opts;
  const candidates = [
    item?.content,
    item?.body,
    item?.full_text,
    item?.description,
    item?.summary,
    item?.text,
  ];
  let best = "";
  for (const c of candidates) {
    const plain = extractPlainText(c);
    if (plain && plain.length > best.length) best = plain;
  }
  if (!best) return false;
  if (best.length < minChars) return false;

  if (minWords > 0) {
    const words = best.split(" ").filter(Boolean);
    if (words.length < minWords) return false;
  }
  return true;
}

export function hasValidImage(item) {
  const img = item?.image || item?.cover_image || item?.preview_image || item?.thumbnail;
  if (!img) return false;
  const s = String(img);
  return s && !PLACEHOLDER_SUBSTRINGS.some((ph) => s.includes(ph));
}

export function buildInternalHref(n) {
  const has = (v) => v !== undefined && v !== null;

  if (n?.type === "article" && n?.slug) return `/news/article/${n.slug}`;
  if (n?.type === "imported" && has(n?.id)) return `/news/imported/${n.id}`;
  if (n?.type && n?.slugOrId) return `/news/${n.type}/${n.slugOrId}`;

  if (n?.slug && !/^\d+$/.test(String(n.slug))) return `/news/article/${n.slug}`;
  if (n?.slugOrId) {
    return /^\d+$/.test(String(n.slugOrId))
      ? `/news/imported/${n.slugOrId}`
      : `/news/article/${n.slugOrId}`;
  }
  if (has(n?.id)) return `/news/imported/${n.id}`;

  return "#";
}
