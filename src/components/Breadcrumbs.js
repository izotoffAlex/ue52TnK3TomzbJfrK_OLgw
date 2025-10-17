// Путь: frontend/src/components/Breadcrumbs.js
// Назначение: Хлебные крошки для новостей и категорий IzotovLife
// Комментарий: Поддержка отображения категории и новости, корректные ссылки на короткие SEO-пути

import React from "react";
import { Link } from "react-router-dom";

export default function Breadcrumbs({ item = null, categorySlug = "", categoryTitle = "" }) {
  const hasItem = !!item;
  const catSlug = categorySlug || (item?.category_slug || "");
  const catTitle = categoryTitle || (item?.category_name || "");

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
        {catSlug && catTitle && (
          <li className="inline-flex items-center">
            <Link to={catSlug.startsWith("/") ? catSlug : `/${catSlug}/`} className="hover:text-yellow-400">
              {catTitle}
            </Link>
            {hasItem && <span className="mx-2">›</span>}
          </li>
        )}

        {/* Текущая новость */}
        {hasItem && (
          <li className="inline-flex items-center text-gray-300">
            <span>{item.title || item.name || "Новость"}</span>
          </li>
        )}
      </ol>
    </nav>
  );
}
