// Путь: frontend/src/components/AuthorArticleCard.js
// Назначение: Карточка авторской статьи (Article) для страницы "Авторские материалы".
// Почему отдельным компонентом:
// - На /avtorskie-materialy/ мы показываем только Article (без ImportedNews/RSS).
// - Нужно вывести подпись автора с гиперссылкой на публичную страницу автора (/author/:id).
// - Нельзя поломать универсальный NewsCard, который используется во всех остальных категориях.

import React, { useMemo } from "react";
import { Link } from "react-router-dom";

function pickAuthor(a) {
  return a?.author || a?.author_obj || a?.user || a?.owner || null;
}

function authorName(author) {
  if (!author) return "Автор";
  const fn = (author?.first_name || "").trim();
  const ln = (author?.last_name || "").trim();
  const full = [fn, ln].filter(Boolean).join(" ");
  return full || author?.display_name || author?.username || author?.name || author?.slug || "Автор";
}

function authorHref(author) {
  if (!author) return "#";
  const id = author?.id ?? author?.pk ?? author?.slug ?? author?.username;
  return id ? `/author/${id}` : "#";
}

function articleHref(article) {
  const slug = article?.slug;
  return slug ? `/a/${slug}` : "#";
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ru-RU");
  } catch {
    return "";
  }
}

export default function AuthorArticleCard({ article }) {
  const author = useMemo(() => pickAuthor(article), [article]);

  return (
    <article className="rounded-xl border border-[var(--app-border)] bg-[var(--bg-card)] p-4">
      <h3 className="text-lg font-semibold leading-snug mb-2">
        <Link to={articleHref(article)} className="hover:underline" style={{ color: "inherit" }}>
          {article?.title || "Без названия"}
        </Link>
      </h3>

      <div className="text-sm text-gray-400">
        Автор:{" "}
        <Link to={authorHref(author)} className="text-blue-400 hover:underline">
          {authorName(author)}
        </Link>
      </div>

      {article?.published_at && (
        <time className="block text-xs text-gray-500 mt-1">{formatDate(article.published_at)}</time>
      )}
    </article>
  );
}
