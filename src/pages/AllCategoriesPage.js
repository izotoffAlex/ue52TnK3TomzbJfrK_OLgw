// frontend/src/pages/AllCategoriesPage.js
// Назначение: Страница со всеми категориями новостей.
// Путь: frontend/src/pages/AllCategoriesPage.js

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCategories } from "../Api";

export default function AllCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories()
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
        } else if (data?.results) {
          setCategories(data.results);
        } else {
          setCategories([]);
        }
      })
      .catch((err) => {
        console.error("Ошибка загрузки категорий:", err);
        setCategories([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-gray-400 text-center mt-8">Загрузка категорий...</p>;
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">Все категории</h1>

      {categories.length === 0 ? (
        <p className="text-gray-400">Категории пока не найдены</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <li key={cat.id}>
              <Link
                to={`/category/${cat.slug}`}
                className="block p-4 rounded-lg border border-gray-700 hover:bg-gray-800 hover:border-gray-500 transition text-white text-center font-medium"
              >
                {cat.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
