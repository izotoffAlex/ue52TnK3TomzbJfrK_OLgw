// frontend/src/pages/AuthorPage.js
// Назначение: Публичная страница автора (фото, био, список статей).
// Путь: frontend/src/pages/AuthorPage.js

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../Api";

export default function AuthorPage() {
  const { id } = useParams();
  const [author, setAuthor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/authors/${id}/`)
      .then((res) => setAuthor(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div>Загрузка…</div>;
  if (!author) return <div>Автор не найден</div>;

  return (
    <div className="max-w-3xl mx-auto p-4">
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
          <p className="text-gray-600">{author.bio}</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-3">Статьи автора</h2>
      <div className="space-y-4">
        {author.articles.map((a) => (
          <div key={a.id} className="p-4 border rounded">
            {a.cover_image && (
              <img
                src={a.cover_image}
                alt=""
                className="w-full h-40 object-cover mb-2"
              />
            )}
            <Link
              to={`/article/${a.slug}`}
              className="text-lg font-bold text-blue-600 hover:underline"
            >
              {a.title}
            </Link>
            <div className="text-sm text-gray-500">
              {new Date(a.published_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
