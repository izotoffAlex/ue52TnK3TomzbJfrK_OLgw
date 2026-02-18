// Путь: frontend/src/components/Seo.js
// Назначение: Унифицированная установка SEO-тегов (title/description/canonical/og/twitter)
// через react-helmet-async. Используется на страницах (роутах) для уникальных описаний.

import React from "react";
import { Helmet } from "react-helmet-async";

export default function Seo({
  title,
  description,
  canonical,
  ogImage = "https://izotovlife.ru/logo512.png",
}) {
  const safeTitle =
    title || "IzotovLife — свежие новости из всех источников";
  const safeDescription =
    description ||
    "IzotovLife — новостной агрегатор: свежие новости России и мира, удобная лента и рубрики.";

  const safeCanonical = canonical || "https://izotovlife.ru/";

  return (
    <Helmet>
      <title>{safeTitle}</title>
      <meta name="description" content={safeDescription} />

      <link rel="canonical" href={safeCanonical} />

      <meta property="og:title" content={safeTitle} />
      <meta property="og:description" content={safeDescription} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={safeCanonical} />
      <meta property="og:image" content={ogImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={safeTitle} />
      <meta name="twitter:description" content={safeDescription} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}
