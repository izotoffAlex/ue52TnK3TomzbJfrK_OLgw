// frontend/src/components/NewsCardText.js
// Назначение: Текстовая карточка новости (для статей и RSS).
// Путь: frontend/src/components/NewsCardText.js

import React from "react";
import { Link } from "react-router-dom";

export default function NewsCardText({ item }) {
  const title = item?.title || "Без названия";
  const description = item?.description || "";
  const preview = description ? description.slice(0, 150) + "..." : "";

  return (
    <article className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 hover:shadow-md transition flex flex-col">
      <h3 className="text-lg font-bold mb-2 text-white">
        {item.type === "article" && item.slug ? (
          <Link to={`/article/${item.slug}`} className="hover:underline">
            {title}
          </Link>
        ) : item.type === "rss" && item.id ? (
          <Link to={`/rss/${item.id}`} className="hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
      </h3>

      {preview && <p className="text-sm text-gray-300">{preview}</p>}
    </article>
  );
}
