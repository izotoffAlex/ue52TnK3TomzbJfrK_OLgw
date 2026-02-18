// Путь: frontend/src/components/Breadcrumbs.js
// Назначение: Хлебные крошки (общий компонент).
//
// FIX (2026-02-07):
// ✅ Добавлена поддержка крошки автора для авторских материалов:
//    "Главная > Авторские статьи > <Автор> > <Статья>"
// ✅ Автор берётся из item.author_username / item.author_login / item.author (object)
// ✅ Не трогаем импортные новости (у них автора нет)

import React, { useMemo } from "react";
import { Link } from "react-router-dom";

/**
 * Нормализация slug -> путь категории на сайте.
 * Примеры:
 *  - "politika" -> "/politika/"
 *  - "/politika/" -> "/politika/"
 *  - "avtorskie-materialy" -> "/avtorskie-materialy/"
 */
function normalizeHrefFromSlug(slug) {
  if (!slug) return "";
  const s = String(slug).trim();
  if (!s) return "";
  if (s.startsWith("/")) {
    let out = s.replace(/\/{2,}/g, "/");
    if (!out.endsWith("/")) out += "/";
    return out;
  }
  return `/${s.replace(/\/{2,}/g, "/")}/`;
}

/* =========================
   Хелперы для автора (UI)
   ========================= */

/**
 * Достаём данные автора из item (разные сериализаторы могут отдавать разными ключами).
 * Возвращает { username, title } или null.
 *
 * Используется для хлебных крошек: "Главная > Авторские материалы > <Автор> > <Статья>"
 */
function deriveAuthorCrumb(item) {
  if (!item || typeof item !== "object") return null;

  const username = String(
    item.author_username ||
      item.author_login ||
      item.author_slug ||
      item.author?.username ||
      item.author?.login ||
      item.author?.slug ||
      ""
  ).trim();

  if (!username) return null;

  const title = String(
    item.author_display ||
      item.author_name ||
      item.author_full_name ||
      item.author?.display ||
      item.author?.name ||
      item.author?.full_name ||
      username
  ).trim();

  return { username, title: title || username };
}

function buildAuthorHref(username) {
  const u = String(username || "").trim();
  if (!u) return "";
  // У нас на фронте есть страница автора (AuthorPage). Маршрут: /author/<login>/
  return `/author/${encodeURIComponent(u)}/`;
}

export default function Breadcrumbs({ category, item }) {
  const { isAuthorArticle, catTitlePretty, catHref, hasItem } = useMemo(() => {
    const catSlug = category?.slug || category?.seo_slug || category?.category_slug || null;
    const catName = category?.name || category?.title || null;

    // Признак авторского материала:
    // 1) item.seo_url включает /articles/
    // 2) item.model/type явно article
    // 3) category.slug == avtorskie-materialy
    const seoUrl = String(item?.seo_url || "");
    const bySeo = seoUrl.includes("/articles/");
    const byModel =
      String(item?.model || item?.type || item?._type || "").toLowerCase() === "article";
    const byCat = String(catSlug || "").toLowerCase() === "avtorskie-materialy";

    const isAuthorArticle = Boolean(bySeo || byModel || byCat);

    const catTitlePretty = isAuthorArticle ? "Авторские статьи" : (catName || "");
    const catHref = catSlug ? normalizeHrefFromSlug(catSlug) : "";

    const hasItem = Boolean(item && (item.title || item.name));
    return { isAuthorArticle, catTitlePretty, catHref, hasItem };
  }, [category, item]);

  const finalCatTitle = isAuthorArticle ? "Авторские статьи" : catTitlePretty;
  const finalCatHref = isAuthorArticle ? "/avtorskie-materialy/" : catHref;

  // ✅ Автор для крошек (только для авторских материалов)
  const authorCrumb = isAuthorArticle ? deriveAuthorCrumb(item) : null;
  const authorHref = authorCrumb ? buildAuthorHref(authorCrumb.username) : "";

  return (
    <nav className="text-gray-400 text-sm mb-4" aria-label="Breadcrumb">
      <ol className="list-none p-0 inline-flex">
        {/* Главная */}
        <li className="inline-flex items-center">
          <Link to="/" className="hover:text-yellow-400">
            Главная
          </Link>
          <span className="mx-2">›</span>
        </li>

        {/* Категория */}
        {finalCatHref && finalCatTitle && (
          <li className="inline-flex items-center">
            <Link to={finalCatHref} className="hover:text-yellow-400">
              {finalCatTitle}
            </Link>
            {hasItem && <span className="mx-2">›</span>}
          </li>
        )}

        {/* Автор (для авторских материалов) */}
        {authorCrumb && authorHref && (
          <li className="inline-flex items-center">
            <Link to={authorHref} className="hover:text-yellow-400">
              {authorCrumb.title}
            </Link>
            {hasItem && <span className="mx-2">›</span>}
          </li>
        )}

        {/* Текущий материал */}
        {hasItem && (
          <li className="inline-flex items-center text-gray-300">
            <span>{item.title || item.name || "Материал"}</span>
          </li>
        )}
      </ol>
    </nav>
  );
}
