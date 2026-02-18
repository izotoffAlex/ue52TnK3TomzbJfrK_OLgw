// Путь: frontend/src/components/SourceLabel.js
// Назначение: Вывести строку метаданных под заголовком карточки/текста.
//
// UPDATE (2026-02-07):
// ✅ Для author-статей (type === "article") показываем "Автор: <имя>".
// ✅ Автор кликабелен и ведёт на /author/<id>/ (SPA Link).
// ✅ Для RSS/новостей оставляем "Источник: <имя>".
// ⛔ Больше НЕ рендерим <a href="...">, чтобы не создавать вложенные ссылки внутри <Link> карточки.

import React from "react";
import { Link } from "react-router-dom";

function extractHostname(maybeUrl) {
  if (!maybeUrl || typeof maybeUrl !== "string") return null;
  try {
    const u = new URL(maybeUrl);
    return u.hostname.replace(/^www\./i, "");
  } catch {
    const m = maybeUrl.match(/^(?:https?:\/\/)?(?:www\.)?([^/:?#]+)(?:[/:?#]|$)/i);
    return m ? m[1].replace(/^www\./i, "") : null;
  }
}

function isAuthorArticle(item) {
  return String(item?.type || "").toLowerCase() === "article";
}

function getAuthorInfo(item) {
  if (!item) return { id: null, name: null };

  const obj =
    item.author_obj ||
    (typeof item.author === "object" ? item.author : null) ||
    item.user_obj ||
    item.owner_obj ||
    null;

  const idFromObj = obj?.id ?? obj?.pk ?? null;

  const nameFromObj =
    (obj?.display_name || "").trim() ||
    [obj?.first_name, obj?.last_name].filter(Boolean).join(" ").trim() ||
    (obj?.username || "").trim() ||
    (obj?.login || "").trim() ||
    (obj?.slug || "").trim() ||
    null;

  const idFlat =
    item.author_id ??
    (typeof item.author === "number" || typeof item.author === "string" ? item.author : null) ??
    item.user_id ??
    null;

  const nameFlat =
    (item.author_name || "").trim() ||
    (item.author_username || "").trim() ||
    (item.author_login || "").trim() ||
    null;

  const id = idFromObj ?? idFlat ?? null;
  const name = nameFromObj ?? nameFlat ?? (id ? "Автор" : null);

  return { id, name };
}

function getSourceName(item) {
  if (!item) return null;

  const s = item.source || item.publisher || item.provider;
  if (s) {
    const nested = s.display_name || s.title || s.name || s.site_name || s.source_name;
    if (nested && String(nested).trim()) return String(nested).trim();
  }

  const flat =
    item.source_title ||
    item.source_name ||
    item["source__name"] ||
    item.publisher_name ||
    item.provider_name ||
    item.feed_title;

  if (flat && String(flat).trim()) return String(flat).trim();

  const url = item.source_url || item.original_url || item.link || item.url || null;
  const host = extractHostname(url);
  return host || null;
}

export default function SourceLabel({ item, className = "" }) {
  // Авторская статья
  if (isAuthorArticle(item)) {
    const a = getAuthorInfo(item);
    if (!a?.id && !a?.name) return null;

    const label = (
      <>
        <span style={{ opacity: 0.7, marginRight: 6 }}>Автор:</span>
        <span>{a?.name || "Автор"}</span>
      </>
    );

    // Страница автора в рамках SPA — ОК, это <Link>, не <a href="..."> наружу
    if (a?.id !== null && a?.id !== undefined && String(a.id).trim() !== "") {
      const to = `/author/${encodeURIComponent(String(a.id))}/`;
      return (
        <Link
          to={to}
          className={className}
          style={{ textDecoration: "none" }}
          title="Открыть страницу автора"
        >
          {label}
        </Link>
      );
    }

    return <div className={className}>{label}</div>;
  }

  // Обычная новость (RSS/лента)
  const name = getSourceName(item);

  if (!name) return null;

  // ⚠️ Больше НЕ делаем <a href="...">, только текстовая метка.
  const content = (
    <>
      <span style={{ opacity: 0.7, marginRight: 6 }}>Источник:</span>
      <span>{name}</span>
    </>
  );

  return <div className={className}>{content}</div>;
}
