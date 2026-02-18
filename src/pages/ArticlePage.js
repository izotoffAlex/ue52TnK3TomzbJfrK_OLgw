// Путь: frontend/src/pages/ArticlePage.js
// Назначение: Страница детального просмотра статьи/новости с хлебными крошками и кнопкой "Читать в источнике"
// Путь: frontend/src/pages/ArticlePage.js
//
// UPDATE (2026-02-05):
// ✅ FIX: передаём Breadcrumbs реальный item (article), чтобы крошки могли показать заголовок.
// ✅ FIX: пытаемся корректно вычислить категорию из данных статьи (category_slug / seo_url / category_display).
// ✅ Для /articles/... Breadcrumbs (по нашему правилу) сам покажет "Авторские статьи" и игнорирует "News".

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchArticle } from "../Api";
import Breadcrumbs from "../components/Breadcrumbs";

/**
 * Пытаемся получить slug категории для крошек.
 * 1) article.category_slug (если API даёт)
 * 2) вытащить из article.seo_url первый сегмент: "/nauka/..." -> "nauka"
 * 3) если ничего нет — вернуть пусто (тогда крошки покажут только "Главная" и заголовок)
 */
function deriveCategorySlug(article) {
  if (!article) return "";

  const direct = String(article.category_slug || "").trim();
  if (direct) return direct;

  const seoUrl = String(article.seo_url || article.url || "").trim();
  // ожидаем формат "/<cat>/<slug>/" или "/<cat>/..."
  const m = seoUrl.match(/^\/([^/]+)\/.+/);
  if (m && m[1]) return m[1];

  return "";
}

export default function ArticlePage() {
  const { slug } = useParams(); // slug новости приходит из URL
  const [article, setArticle] = useState(null);

  useEffect(() => {
    let alive = true;

    fetchArticle(slug)
      .then((data) => {
        if (!alive) return;
        setArticle(data);
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      alive = false;
    };
  }, [slug]);

  const categorySlug = useMemo(() => deriveCategorySlug(article), [article]);

  // Отображаемое имя категории (если есть)
  const categoryTitle = useMemo(() => {
    if (!article) return "";
    return (
      String(article.category_display || "").trim() ||
      String(article.category_name || "").trim() ||
      String(article.category?.name || "").trim() ||
      ""
    );
  }, [article]);

  if (!article) {
    return <div className="text-white px-4 py-6">Загрузка...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Хлебные крошки */}
      <Breadcrumbs item={article} categorySlug={categorySlug} categoryTitle={categoryTitle} />

      {/* Заголовок */}
      <h1 className="text-2xl font-bold text-white mb-4">{article.title}</h1>

      {/* Изображение */}
      {article.image && (
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-auto rounded mb-4"
        />
      )}

      {/* Контент */}
      <div
        className="prose prose-invert max-w-none mb-6"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* Кнопка "Читать в источнике" */}
      {article.source_url && (
        <a
          href={article.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Читать в источнике
        </a>
      )}
    </div>
  );
}
