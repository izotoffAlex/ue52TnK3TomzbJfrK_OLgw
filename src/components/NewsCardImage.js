// frontend/src/components/NewsCardImage.js
// Назначение: Карточка новости с картинкой (для статей и RSS).
// Путь: frontend/src/components/NewsCardImage.js

import React from "react";
import { Link } from "react-router-dom";

export default function NewsCardImage({ item }) {
  return (
    <article className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden hover:shadow-lg transition flex flex-col">
      {item.image && (
        <img
          src={item.image}
          alt=""
          className="w-full h-40 object-cover"
          loading="lazy"
        />
      )}

      <div className="p-3 flex flex-col flex-1">
        <h3 className="text-lg font-bold mb-2 text-white flex-1">
          {item.type === "article" && item.slug ? (
            <Link to={`/article/${item.slug}`} className="hover:underline">
              {item.title}
            </Link>
          ) : item.type === "rss" && item.id ? (
            <Link to={`/rss/${item.id}`} className="hover:underline">
              {item.title}
            </Link>
          ) : (
            <span>{item.title}</span>
          )}
        </h3>

        {/* Ссылка "Подробнее" → всегда внутренняя страница */}
        {item.type === "article" && item.slug ? (
          <Link
            to={`/article/${item.slug}`}
            className="text-blue-400 hover:underline mt-2 block"
          >
            Подробнее →
          </Link>
        ) : item.type === "rss" && item.id ? (
          <Link
            to={`/rss/${item.id}`}
            className="text-blue-400 hover:underline mt-2 block"
          >
            Подробнее →
          </Link>
        ) : null}
      </div>
    </article>
  );
}
