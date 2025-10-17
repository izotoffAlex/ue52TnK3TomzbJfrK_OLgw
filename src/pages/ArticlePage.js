// frontend/src/pages/ArticlePage.js
// Назначение: Страница детального просмотра статьи/новости с хлебными крошками и кнопкой "Читать в источнике"
// Путь: frontend/src/pages/ArticlePage.js

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchArticle } from "../Api";
import Breadcrumbs from "../components/Breadcrumbs";

export default function ArticlePage() {
  const { slug } = useParams(); // slug новости приходит из URL
  const [article, setArticle] = useState(null);

  useEffect(() => {
    fetchArticle(slug).then(setArticle).catch(console.error);
  }, [slug]);

  if (!article) {
    return <div className="text-white px-4 py-6">Загрузка...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Хлебные крошки */}
      <Breadcrumbs />

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
