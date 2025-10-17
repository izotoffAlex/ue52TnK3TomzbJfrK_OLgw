// frontend/src/pages/LegacyRedirect.js
// Назначение: Редирект со старых маршрутов (/news/a/:slugOrId и /news/i/:slugOrId)
// на новые SEO-маршруты:
//   • /news/a/:slugOrId → /news/:categorySlug/:articleSlug
//   • /news/i/:slugOrId → /news/:sourceSlug/:importedSlug

import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

// В реальном проекте можно запросить backend, чтобы узнать categorySlug/sourceSlug.
// Пока сделаем простой редирект:
//   article → /news/unknown-category/:slug
//   rss     → /news/unknown-source/:slug

export default function LegacyRedirect({ kind }) {
  const { slugOrId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!slugOrId) return;

    if (kind === "article") {
      navigate(`/news/unknown-category/${slugOrId}`, { replace: true });
    } else if (kind === "rss") {
      navigate(`/news/unknown-source/${slugOrId}`, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [slugOrId, kind, navigate]);

  return <div>Перенаправление…</div>;
}
