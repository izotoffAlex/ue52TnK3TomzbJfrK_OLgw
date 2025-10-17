// frontend/src/pages/AuthorPage.js
// Назначение: Публичная страница автора (фото, био, список опубликованных статей).
// Обновления:
//   • Теперь данные профиля берутся из /api/accounts/:id/.
//   • Статьи автора грузятся отдельно через /api/news/author/articles/?author=id&status=PUBLISHED.
//   • Используется Tailwind для карточек статей.

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../Api";

export default function AuthorPage() {
  const { id } = useParams();
  const [author, setAuthor] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Профиль автора
        const { data: profile } = await api.get(`/accounts/${id}/`);
        setAuthor(profile);

        // Статьи автора (только опубликованные)
        const { data: arts } = await api.get(
          `/news/author/articles/?author=${id}&status=PUBLISHED`
        );
        setArticles(arts.results || arts); // поддержка пагинации и обычного списка
      } catch (err) {
        console.error("Ошибка загрузки автора:", err);
        setAuthor(null);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="p-4">Загрузка…</div>;
  if (!author) return <div className="p-4">Автор не найден</div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Блок профиля */}
      <div className="flex items-center gap-4 mb-6">
        {author.photo && (
          <img
            src={author.photo}
            alt={author.username}
            className="w-20 h-20 rounded-full object-cover"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold">{author.username}</h1>
          {author.bio && <p className="text-gray-600">{author.bio}</p>}
        </div>
      </div>

      {/* Статьи автора */}
      <h2 className="text-xl font-semibold mb-3">Статьи автора</h2>
      {articles.length === 0 ? (
        <p className="text-gray-500">У этого автора пока нет опубликованных статей.</p>
      ) : (
        <div className="space-y-4">
          {articles.map((a) => (
            <div key={a.id || a.slug} className="p-4 border rounded hover:shadow">
              {a.cover_image && (
                <img
                  src={a.cover_image}
                  alt=""
                  className="w-full h-40 object-cover mb-2 rounded"
                />
              )}
              <Link
                to={`/news/${a.categories?.[0]?.slug || "news"}/${a.slug}`}
                className="text-lg font-bold text-blue-600 hover:underline"
              >
                {a.title}
              </Link>
              <div className="text-sm text-gray-500">
                {a.published_at
                  ? new Date(a.published_at).toLocaleDateString()
                  : "Без даты"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
