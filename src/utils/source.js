// Путь: frontend/src/utils/source.js
// Назначение: Унифицированно извлекать имя источника из объекта результата поиска.
// Новый файл. Ничего существующее не удаляем.
//
// Алгоритм:
// 1) Пробуем «говорящие» поля (строки или объекты с .title/.name).
// 2) Пробуем доменные поля (domain/host/...).
// 3) Пробуем любые URL-поля — парсим hostname.
// 4) Возвращаем аккуратное «rg.ru» и т. п. (без http:// и www.).
function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (!v) continue;
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "object") {
      if (typeof v.title === "string" && v.title.trim()) return v.title.trim();
      if (typeof v.name === "string" && v.name.trim()) return v.name.trim();
      if (typeof v.display_name === "string" && v.display_name.trim()) return v.display_name.trim();
    }
  }
  return null;
}

function cleanHost(s) {
  return String(s)
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .trim();
}

function hostFromUrlLike(s) {
  if (!s) return null;
  try {
    // если строка без протокола — URL бросит исключение
    const u = new URL(s);
    return u.hostname ? cleanHost(u.hostname) : null;
  } catch (_) {
    // вручную достанем «домен» из строки
    return cleanHost(s);
  }
}

export function extractSourceName(item) {
  if (!item || typeof item !== "object") return "";

  // 1) самые частые поля (строки или объекты)
  const direct =
    pick(item, [
      "source_title",
      "source_name",
      "source",          // может быть строкой/объектом
      "publisher",
      "provider",
      "site_name",
      "siteName",
      "origin",
      "news_source",
      "outlet",
    ]) ||
    item?.source?.title ||
    item?.source?.name ||
    item?.provider?.title ||
    item?.provider?.name;

  if (direct) return cleanHost(direct);

  // 2) доменные поля
  const domain =
    item?.domain ||
    item?.host ||
    item?.website ||
    item?.website_domain ||
    item?.source_domain ||
    item?.source_host ||
    item?.origin_domain;

  if (domain) return cleanHost(domain);

  // 3) любые URL-поля
  const urlLike =
    item?.source_url ||
    item?.sourceUrl ||
    item?.source_link ||
    item?.original_url ||
    item?.original_link ||
    item?.canonical_url ||
    item?.external_url ||
    item?.link ||
    item?.url;

  const host = hostFromUrlLike(urlLike);
  if (host) return host;

  return "";
}
