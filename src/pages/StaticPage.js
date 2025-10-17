// frontend/src/pages/StaticPage.js
// Назначение: Вывод содержимого статической страницы (Политика, О компании и т.д.)
// Путь: frontend/src/pages/StaticPage.js

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchPage } from "../Api";

export default function StaticPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);

  useEffect(() => {
    fetchPage(slug).then(setPage).catch(console.error);
  }, [slug]);

  if (!page) {
    return <div className="text-gray-400">Загрузка...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 text-gray-200">
      <h1 className="text-2xl font-bold mb-4">{page.title}</h1>
      <div
        className="prose prose-invert"
        dangerouslySetInnerHTML={{ __html: page.content }}
      />
    </div>
  );
}
