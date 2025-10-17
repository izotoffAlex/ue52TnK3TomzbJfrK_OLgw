// frontend/src/components/CategoriesBar.js
// Назначение: Полоса категорий по центру, с активной подсветкой и кнопкой "ещё"
// Исправлено: убраны цифры (news_count), выводится только имя категории
// Путь: frontend/src/components/CategoriesBar.js

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchCategories } from "../Api";

export default function CategoriesBar() {
  const [categories, setCategories] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const location = useLocation();

  useEffect(() => {
    fetchCategories()
      .then((data) => {
        const cats = Array.isArray(data) ? data : data.results || [];
        setCategories(cats);
      })
      .catch(console.error);
  }, []);

  const visible = categories.slice(0, 10);
  const hidden = categories.slice(10);

  return (
    <div className="categories-bar">
      <div className="wrap-wrapper">
        {visible.map((cat) => {
          const active = location.pathname === `/category/${cat.slug}`;
          return (
            <Link
              key={cat.slug}
              to={`/category/${cat.slug}`}
              className={`cat-link ${active ? "active" : ""}`}
            >
              {cat.name} {/* ⚡ выводим только имя */}
            </Link>
          );
        })}

        {hidden.length > 0 && (
          <div className="more">
            <button onClick={() => setShowAll(!showAll)}>⋯</button>
            {showAll && (
              <div className="dropdown">
                {hidden.map((cat) => {
                  const active = location.pathname === `/category/${cat.slug}`;
                  return (
                    <Link
                      key={cat.slug}
                      to={`/category/${cat.slug}`}
                      className={`cat-link ${active ? "active" : ""}`}
                      onClick={() => setShowAll(false)}
                    >
                      {cat.name} {/* ⚡ без news_count */}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .categories-bar {
          background: #111;
          border-bottom: 1px solid #333;
          position: relative;
          z-index: 5;
        }
        .wrap-wrapper {
          display: flex;
          justify-content: center;
          gap: 12px;
          padding: 8px 16px;
          flex-wrap: nowrap;
        }
        .cat-link {
          font-size: 14px;
          color: #ccc;
          text-decoration: none;
          padding: 6px 10px;
          border-radius: 4px;
          transition: color 0.2s;
          position: relative;
          white-space: nowrap;
        }
        .cat-link:hover {
          color: #1a73e8;
        }
        .cat-link.active {
          font-weight: bold;
          color: #1a73e8;
        }
        .cat-link.active::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -2px;
          height: 2px;
          background: #1a73e8;
          border-radius: 2px;
        }
        .more {
          position: relative;
        }
        .more button {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #ccc;
          padding: 0 6px;
        }
        .dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          background: #111;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 8px;
          min-width: 200px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
      `}</style>
    </div>
  );
}
