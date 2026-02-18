// Путь: frontend/src/utils/title.js
// Назначение: Нормализация заголовков: режем по `//`, убираем дубликаты/мусор, готовим к выводу.
// Сохранено: splitTitleParts, titleForAttr, getTitlePartsFromItem (как у тебя).
// ДОБАВЛЕНО: cleanTitle, parseSmartTitle (main/sub), buildPrettyTitle (для <title> и мета), limitLength.

const NBSP_RE = /\u00A0/g;
const MULTISPACE_RE = /\s{2,}/g;

/** Разделяет заголовок на части по `//` и нормализует пробелы */
export function splitTitleParts(raw) {
  if (!raw) return [];
  let t = String(raw)
    .replace(NBSP_RE, " ")
    .replace(/\s+/g, " ")
    .replace(/ ?\/\/+ ?/g, " // ")
    .trim();
  const parts = t.split(/\s*\/\/+\s*/).filter(Boolean);
  if (!parts.length) return [t];

  // Убираем дословные дубликаты
  const uniq = [];
  for (const p of parts) {
    if (!uniq.includes(p)) uniq.push(p);
  }
  return uniq;
}

/** Готовит строку для alt/aria: без `//` */
export function titleForAttr(raw) {
  const parts = splitTitleParts(raw);
  return parts.join(" "); // сознательно без разделителей
}

/** Возвращает массив частей для карточки/деталки: item.titleParts приоритетнее */
export function getTitlePartsFromItem(item) {
  if (Array.isArray(item?.titleParts) && item.titleParts.length) {
    return item.titleParts;
  }
  return splitTitleParts(item?.title || "");
}

/* ====== ДОБАВЛЕНО: расширенная нормализация и удобные помощники ====== */

/** Мягкая чистка строки: сжать пробелы, подчистить кавычки/пробелы вокруг тире */
export function cleanTitle(s = "") {
  let t = String(s || "");
  t = t.replace(NBSP_RE, " ");
  t = t.replace(MULTISPACE_RE, " ").trim();
  t = t.replace(/«\s+/g, "«").replace(/\s+»/g, "»");
  t = t.replace(/\s+—\s+/g, " — ");
  return t;
}

/**
 * Возвращает { main, sub }:
 *  - если в заголовке есть `//`, левая часть → main, правая → sub
 *  - если `//` нет, но строка очень длинная, попробуем разрезать по первому " — " (осторожно)
 */
export function parseSmartTitle(raw = "") {
  const parts = splitTitleParts(cleanTitle(raw));
  if (parts.length >= 2) {
    return { main: parts[0], sub: parts.slice(1).join(" — ") };
  }
  const t = parts[0] || "";
  // осторожный хелпер: длинные заголовки иногда маскируют подзаголовок тире
  if (t.length > 90) {
    const idx = t.indexOf(" — ");
    if (idx > 30 && idx < t.length - 30) {
      return { main: t.slice(0, idx), sub: t.slice(idx + 3) };
    }
  }
  return { main: t, sub: "" };
}

/** Для <title> и мета-описаний: "Main: Sub" (или просто "Main") с ограничением длины */
export function buildPrettyTitle(raw = "", maxLen = 140) {
  const { main, sub } = parseSmartTitle(raw);
  const text = sub ? `${main}: ${sub}` : main;
  return limitLength(text, maxLen);
}

/** Обрезает строку до maxLen по словам (на конце ставит …) */
export function limitLength(s = "", maxLen = 140) {
  const t = String(s || "");
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 50 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}
