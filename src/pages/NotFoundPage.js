// Путь: frontend/src/pages/NotFoundPage.js
// Назначение: страница 404 для несуществующих маршрутов SPA (React).
// Особенности:
//   • отдает 404-контент внутри SPA;
//   • <meta name="robots" content="noindex, nofollow">, чтобы Яндекс не индексировал;
//   • НЕ редиректит никуда (особенно не на / и не на /register).

import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px 16px",
        color: "#e5e7eb",
      }}
    >
      <Helmet>
        <title>Страница не найдена — IzotovLife</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <h1 style={{ fontSize: "2rem", marginBottom: "12px" }}>
        404 — страница не найдена
      </h1>
      <p style={{ maxWidth: 480, marginBottom: 24, color: "#9ca3af" }}>
        Такой страницы на IzotovLife нет. Возможно, ссылка устарела
        или была введена с ошибкой.
      </p>
      <Link
        to="/"
        style={{
          padding: "10px 22px",
          borderRadius: 9999,
          background: "#3b82f6",
          color: "#ffffff",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        На главную
      </Link>
    </main>
  );
}
