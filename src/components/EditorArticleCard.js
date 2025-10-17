// frontend/src/components/EditorArticleCard.js
// Назначение: Карточка статьи для редактора с кнопками управления.
// Путь: frontend/src/components/EditorArticleCard.js

import React, { useState } from "react";

export default function EditorArticleCard({ article, onAction }) {
  const [notes, setNotes] = useState("");

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-white">
      <h2 className="text-xl font-semibold mb-2">{article.title}</h2>
      <p className="text-sm text-gray-400 mb-3">
        Автор: {article.author?.username} | Создано:{" "}
        {new Date(article.created_at).toLocaleString()}
      </p>
      <div
        className="prose prose-invert max-w-none mb-3"
        dangerouslySetInnerHTML={{ __html: article.content.slice(0, 200) + "..." }}
      />

      <textarea
        placeholder="Заметка редактора (необязательно)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full p-2 rounded bg-gray-800 border border-gray-600 mb-3 text-sm"
      />

      <div className="flex gap-3">
        <button
          onClick={() => onAction(article.id, "approve", notes)}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded"
        >
          Опубликовать
        </button>
        <button
          onClick={() => onAction(article.id, "needs_revision", notes)}
          className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded"
        >
          На доработку
        </button>
        <button
          onClick={() => onAction(article.id, "reject", notes)}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded"
        >
          Отклонить
        </button>
      </div>
    </div>
  );
}
