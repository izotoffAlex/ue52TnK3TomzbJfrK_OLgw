// Путь: frontend/src/utils/title.js
// Назначение: Нормализация заголовков: режем по `//`, убираем дубликаты/мусор, готовим к выводу.

/** Разделяет заголовок на части по `//` и нормализует пробелы */
export function splitTitleParts(raw) {
  if (!raw) return [];
  let t = String(raw)
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
