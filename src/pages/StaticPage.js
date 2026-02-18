// Путь: frontend/src/pages/StaticPage.js
// Назначение: Вывод содержимого статической страницы (Политика, О компании и т.д.)
// Особенности:
//   ✅ Подтягивает данные страницы через fetchPage(slug)
//   ✅ Показывает заголовок и HTML-контент страницы
//   ✅ SEO через react-helmet-async:
//        • <title> = seo_title или "Название – IzotovLife"
//        • <meta name="description"> из seo_description или из первых строк текста
//        • <link rel="canonical"> = ФАКТИЧЕСКИЙ URL страницы (window.location)
//   ✅ ДОБАВЛЕНО: уникальные SEO-описания для slug: rusfond, programmy
//   ⚠️ Ничего существующего не удалено — только дополнено и исправлен canonical.

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { fetchPage } from "../Api";

/**
 * Вытаскиваем краткое описание из html-контента:
 *   • убираем теги
 *   • сжимаем пробелы
 *   • обрезаем до maxLen символов
 */
function makePageDescription(page, maxLen = 170) {
  if (!page) return "";
  const candidates = [
    page.seo_description,
    page.description,
    page.excerpt,
    page.content,
  ].filter(Boolean);

  if (!candidates.length) return "";

  const raw = String(candidates[0])
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) return "";
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, maxLen).replace(/[\s.,!?:;\-—–]+$/u, "") + "…";
}

function ensureTrailingSlash(url) {
  if (!url) return url;
  return url.endsWith("/") ? url : url + "/";
}

export default function StaticPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);

  useEffect(() => {
    if (!slug) return;
    fetchPage(slug).then(setPage).catch(console.error);
  }, [slug]);

  // ✅ ЯВНЫЕ УНИКАЛЬНЫЕ SEO-ОПИСАНИЯ ДЛЯ ПРОБЛЕМНЫХ СТРАНИЦ
  const seoOverrides = useMemo(
    () => ({
      rusfond: {
        title: "Русфонд — IzotovLife",
        description:
          "Русфонд на IzotovLife: информация о благотворительных материалах и инициативах. Читайте публикации, проверяйте детали и поддерживайте важные проекты.",
      },
      programmy: {
        title: "Программы — IzotovLife",
        description:
          "Программы на IzotovLife: подборка проектов, тематических разделов и материалов. Быстрый доступ к ключевым страницам и полезной информации.",
      },
    }),
    []
  );

  if (!page) {
    return <div className="text-gray-400">Загрузка...</div>;
  }

  // === SEO: заголовок ===
  const metaTitle =
    seoOverrides?.[slug]?.title ||
    (page.seo_title
      ? page.seo_title
      : page.title
      ? `${page.title} – IzotovLife`
      : "IzotovLife");

  // === SEO: описание ===
  const metaDescription =
    seoOverrides?.[slug]?.description ||
    makePageDescription(page) ||
    "IzotovLife — новостной агрегатор. Информация о проекте и правила использования материалов.";

  // === SEO: canonical (ВАЖНО: берём ФАКТИЧЕСКИЙ URL страницы, а не /pages/<slug>/) ===
  // Это убирает рассинхрон, если реальные страницы живут как /rusfond/ и /programmy/
  const canonicalUrl =
    typeof window !== "undefined" && window.location
      ? ensureTrailingSlash(`${window.location.origin}${window.location.pathname}`)
      : slug
      ? `https://izotovlife.ru/${slug}/`
      : "https://izotovlife.ru/";

  const ogImage = "https://izotovlife.ru/logo512.png";

  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />

        {/* OpenGraph + Twitter (помогает соцсетям и иногда ускоряет консистентность сниппетов) */}
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImage} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={ogImage} />
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 py-6 text-gray-200">
        <h1 className="text-2xl font-bold mb-4">{page.title}</h1>

        <div
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      </div>
    </>
  );
}

