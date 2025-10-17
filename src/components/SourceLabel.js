// frontend/src/components/SourceLabel.js
// Назначение: Вывести «Источник: <имя/домен>» со ссылкой на оригинал (если есть).
// Логика:
//  • Берём имя из разных полей (source.name/title, source_name/source_title и т.д.).
//  • Если имени нет — берём домен из link/url.
//  • Если ничего нет — компонент ничего не рендерит (без пустого «Источник»).
// Путь: frontend/src/components/SourceLabel.js

import React from "react";

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

function getSourceHref(item) {
  if (!item) return null;
  return item.original_url || item.source_url || item.link || item.url || null;
}

export default function SourceLabel({ item, className = "" }) {
  const name = getSourceName(item);
  const href = getSourceHref(item);

  if (!name) return null;

  const content = (
    <>
      <span style={{ opacity: 0.7, marginRight: 6 }}>Источник:</span>
      <span>{name}</span>
    </>
  );

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={{ textDecoration: "none" }}
      title={`Открыть оригинал: ${name}`}
    >
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}
