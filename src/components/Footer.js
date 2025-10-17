// frontend/src/components/Footer.js
// Назначение: Футер сайта с обязательными и дополнительными статическими страницами.
// Теперь показывает индикатор загрузки, пока API возвращает список страниц.

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPages } from "../Api";

export default function Footer() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPages()
      .then((data) => setPages(data))
      .catch((err) => console.error("Ошибка загрузки страниц:", err))
      .finally(() => setLoading(false));
  }, []);

  const mandatoryPages = [
    { slug: "politika-konfidencialnosti", title: "Политика конфиденциальности" },
    { slug: "pravila-ispolzovaniya", title: "Правила использования" },
    { slug: "o-kompanii", title: "О компании" },
    { slug: "redakcionnaya-politika", title: "Редакционная политика" },
    { slug: "reklama", title: "Реклама" },
    { slug: "kontakty", title: "Контакты" },
  ];

  // Защита: если API вернул не массив
  const safePages = Array.isArray(pages) ? pages : [];
  const extraPages = safePages.filter(
    (p) => !mandatoryPages.find((m) => m.slug === p.slug)
  );

  return (
    <footer className="bg-[var(--bg-card)] border-t border-[var(--border)] py-6 mt-8">
      <div className="max-w-7xl mx-auto px-4 text-sm text-gray-400">
        <div className="flex flex-wrap gap-4">
          {mandatoryPages.map((p) => (
            <Link key={p.slug} to={`/pages/${p.slug}`} className="hover:text-white transition">
              {p.title}
            </Link>
          ))}

          {loading && (
            <span className="text-gray-500 animate-pulse">Загружаем страницы…</span>
          )}

          {!loading &&
            extraPages.map((p) => (
              <Link key={p.id} to={`/pages/${p.slug}`} className="hover:text-white transition">
                {p.title}
              </Link>
            ))}
        </div>

        <div className="mt-4 text-xs text-gray-500">
          © {new Date().getFullYear()} IzotovLife.ru — Все права защищены
        </div>
      </div>
    </footer>
  );
}
