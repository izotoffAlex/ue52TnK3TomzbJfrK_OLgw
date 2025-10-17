// Путь: frontend/src/utils/linkBuilders.js
// Назначение: Единое место генерации внутренних ссылок на детальные страницы.
// Используйте в карточках ленты/поиска/«Похожие», чтобы избежать «кривых» URL.
//
// Как использовать (пример):
//   import { buildDetailLink } from "../utils/linkBuilders";
//   const href = buildDetailLink(item); // вернёт /news/i/:slug для RSS или /news/:category/:slug для авторской

export function buildDetailLink(item) {
  if (!item) return "#";

  if (item.seo_url) return item.seo_url;

  const isRSS =
    item?.type === "rss" ||
    item?.is_imported ||
    (!!item?.link && !item?.content);

  const slug = item.slug || item.seo_slug || item.id;
  if (!slug) return "#";

  if (isRSS) {
    return `/news/i/${slug}`;
  }

  const category = item.categories?.[0]?.slug || "news";
  return `/news/${category}/${slug}`;
}
