// Путь: frontend/src/seo/Seo.js
// Назначение: Унифицированная SEO-обвязка страниц (title/description/canonical/OG/Twitter/robots + JSON-LD).
// Как использовать:
//   <Seo
//     title="Экономика — новости | IzotovLife"
//     description="Свежие новости экономики: рынки, банки, компании, прогнозы."
//     canonical="https://izotovlife.ru/ekonomika/"
//     ogImage="https://izotovlife.ru/logo512.png"
//     noindex={false}
//     jsonLd={{...}} // опционально
//   />
//
// Важно:
// - Ничего не “глобалим” насильно: компонент просто добавляет теги через react-helmet-async.
// - canonical лучше передавать уже “чистый” (без utm).

import React from "react";
import { Helmet } from "react-helmet-async";

function ensureAbsUrl(url) {
  if (!url) return "";
  try {
    // Если уже абсолютный
    if (/^https?:\/\//i.test(url)) return url;
    // Иначе делаем абсолютный относительно текущего origin
    return new URL(url, window.location.origin).toString();
  } catch (e) {
    return url;
  }
}

export default function Seo({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = "website",
  twitterCard = "summary_large_image",
  noindex = false,
  nofollow = false,
  jsonLd = null,
}) {
  const t = title || "IzotovLife — свежие новости из всех источников";
  const d =
    description ||
    "IzotovLife — новостной агрегатор: свежие новости России и мира, удобная лента и рубрики.";

  const can = canonical ? ensureAbsUrl(canonical) : "";
  const ogT = ogTitle || t;
  const ogD = ogDescription || d;
  const ogImg = ensureAbsUrl(ogImage || "https://izotovlife.ru/logo512.png");

  const robots = [
    noindex ? "noindex" : "index",
    nofollow ? "nofollow" : "follow",
  ].join(", ");

  // JSON-LD должен быть строкой (Helmet кладёт внутрь <script> как текст)
  const jsonLdStr =
    jsonLd && typeof jsonLd === "object" ? JSON.stringify(jsonLd) : null;

  return (
    <Helmet>
      <title>{t}</title>
      <meta name="description" content={d} />
      <meta name="robots" content={robots} />

      {can ? <link rel="canonical" href={can} /> : null}

      {/* Open Graph */}
      <meta property="og:title" content={ogT} />
      <meta property="og:description" content={ogD} />
      <meta property="og:type" content={ogType} />
      {can ? <meta property="og:url" content={can} /> : null}
      {ogImg ? <meta property="og:image" content={ogImg} /> : null}
      <meta property="og:site_name" content="IzotovLife" />

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={ogT} />
      <meta name="twitter:description" content={ogD} />
      {ogImg ? <meta name="twitter:image" content={ogImg} /> : null}

      {/* JSON-LD */}
      {jsonLdStr ? (
        <script type="application/ld+json">{jsonLdStr}</script>
      ) : null}
    </Helmet>
  );
}
