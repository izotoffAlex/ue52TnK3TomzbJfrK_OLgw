// frontend/src/pages/EditorDashboard.js
// Назначение: Личный кабинет редактора — модерация статей авторов.
// Путь: frontend/src/pages/EditorDashboard.js

import React, { useEffect, useState } from "react";
import { fetchModerationQueue, reviewArticle } from "../Api";

export default function EditorDashboard() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArticles();
  }, []);

  async function loadArticles() {
    setLoading(true);
    try {
      const data = await fetchModerationQueue();

      // 👇 приведение к массиву
      if (Array.isArray(data)) {
        setArticles(data);
      } else if (data?.results) {
        setArticles(data.results);
      } else {
        setArticles([]);
      }
    } catch (err) {
      console.error("Ошибка загрузки очереди модерации:", err);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(id, action) {
    const notes = prompt(
      action === "revise"
        ? "Укажите причину отправки на доработку"
        : "Комментарий редактора (необязательно)"
    );

    await reviewArticle(id, action, notes || "");
    alert(action === "publish" ? "Статья опубликована" : "Отправлено на доработку");

    setArticles((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="editor-dashboard max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Кабинет редактора</h1>

      {loading ? (
        <p className="text-gray-400">Загрузка...</p>
      ) : articles.length === 0 ? (
        <p className="text-gray-400">Очередь пуста</p>
      ) : (
        <div className="space-y-4">
          {articles.map((a) => (
            <div key={a.id} className="card border border-gray-700 rounded-lg p-4 bg-gray-900">
              <h3 className="text-lg font-bold text-white">{a.title}</h3>
              {a.cover_image && (
                <img
                  src={a.cover_image}
                  alt=""
                  className="mt-2 max-h-40 rounded-md"
                />
              )}
              <div
                className="prose prose-invert mt-2"
                dangerouslySetInnerHTML={{ __html: a.content }}
              />
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => handleReview(a.id, "publish")}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Опубликовать
                </button>
                <button
                  onClick={() => handleReview(a.id, "revise")}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded"
                >
                  На доработку
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
