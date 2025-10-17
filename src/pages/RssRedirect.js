// Путь: frontend/src/pages/RssRedirect.js
// Назначение: Аккуратный редирект со старых ссылок вида /rss/:slug на ваш корректный роут /news/i/:slug.
// Примечание: Ничего не удаляет, только перенаправляет — работает за один рендер.

import React from "react";
import { useParams, Navigate } from "react-router-dom";

export default function RssRedirect() {
  const { slug } = useParams();
  const safe = (slug || "").replace(/[-/]+$/g, "");
  return <Navigate to={`/news/i/${encodeURIComponent(safe)}`} replace />;
}
