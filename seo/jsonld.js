// Путь: frontend/src/seo/jsonld.js
// Назначение: Хелперы для генерации Schema.org JSON-LD (WebSite, BreadcrumbList, NewsArticle).
// Зачем:
//  - поисковикам проще понять структуру сайта
//  - аккуратнее выдача (богатые сниппеты возможны, но не гарантированы)

export function jsonLdWebSite({ siteUrl, siteName }) {
  const url = siteUrl || "https://izotovlife.ru/";
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName || "IzotovLife",
    url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${url}search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function jsonLdBreadcrumbs(items) {
  // items: [{name, url}, ...]
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: (items || []).map((x, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: x.name,
      item: x.url,
    })),
  };
}

export function jsonLdNewsArticle({
  url,
  headline,
  description,
  image,
  datePublished,
  dateModified,
  authorName,
  publisherName,
  publisherLogo,
}) {
  // Важно: даты лучше в ISO: 2026-01-05T12:34:56+03:00
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: url ? { "@type": "WebPage", "@id": url } : undefined,
    headline: headline || "",
    description: description || "",
    image: image ? [image] : undefined,
    datePublished: datePublished || undefined,
    dateModified: dateModified || datePublished || undefined,
    author: authorName
      ? { "@type": "Person", name: authorName }
      : { "@type": "Organization", name: "IzotovLife" },
    publisher: {
      "@type": "Organization",
      name: publisherName || "IzotovLife",
      logo: publisherLogo
        ? { "@type": "ImageObject", url: publisherLogo }
        : undefined,
    },
  };
}
