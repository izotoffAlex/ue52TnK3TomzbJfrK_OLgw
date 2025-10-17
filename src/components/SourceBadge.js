// frontend/src/components/SourceBadge.js
// Назначение: Универсальный бэйдж источника поверх изображения.
// Обновление: без вложенных <a> — когда бэйдж находится внутри <Link>, он рендерит div/button-эквивалент
//             и сам открывает источник в новой вкладке, останавливая всплытие.

import React from "react";
import s from "./SourceBadge.module.css";

// Чистим домен из URL: https://m.www.rg.ru/... → rg.ru
function hostName(url) {
  try {
    const u = new URL(url);
    let h = u.hostname || "";
    h = h.replace(/^www\./i, "").replace(/^m\./i, "").replace(/^amp\./i, "");
    const parts = h.split(".");
    if (parts.length > 2) return parts.slice(-2).join(".");
    return h || null;
  } catch {
    return null;
  }
}

// Нормализация источника (строка | объект | весь item)
function normalizeSource(src) {
  if (!src) return { name: "Источник", url: null, logo: null };

  if (typeof src === "string") return { name: src, url: null, logo: null };

  const candidate = src.source || src.news_source || src.source_fk || src;

  const nameCandidates = [
    candidate.name,
    candidate.title,
    candidate.source_name,
    candidate.source_title,
    candidate.publisher,
    candidate.site,
    candidate.sourceDomain,
  ];

  const urlCandidates = [
    candidate.url,
    candidate.site_url,
    candidate.link,
    candidate.source_url,
    candidate.homepage,
    src.site_url, src.link, src.url, src.source_url,
  ];

  const logoCandidates = [
    candidate.logo, candidate.image, candidate.icon, candidate.logo_url,
    src.logo, src.image, src.icon,
  ];

  const url = urlCandidates.find(Boolean) || null;
  let name = nameCandidates.find(Boolean) || null;

  if (!name && url) name = hostName(url) || null;
  if (!name) name = "Источник";

  const logo = logoCandidates.find(Boolean) || null;
  return { name, url, logo };
}

/**
 * props:
 * - source: строка | объект источника | весь item
 * - href: если нужно переопределить URL источника
 * - align: 'left' | 'right'
 * - className: доп. класс
 * - insideLink: true, если бэйдж вставлен внутрь <Link> (чтобы не было <a> внутри <a>)
 */
export default function SourceBadge({ source, href, align = "right", className = "", insideLink = false }) {
  const norm = normalizeSource(source);
  const link = href || norm.url || null;

  const containerClass = [s.badge, align === "left" ? s.left : s.right, className].join(" ");

  // Если бэйдж внутри <Link>, рисуем <div role="link"> и вручную открываем новую вкладку.
  if (insideLink && link) {
    const open = (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { window.open(link, "_blank", "noopener"); } catch {}
    };
    return (
      <div className={containerClass} title={norm.name}>
        <div className={s.inner} role="link" tabIndex={0}
             onClick={open}
             onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") open(e); }}>
          {norm.logo ? <img className={s.logo} src={norm.logo} alt={norm.name} /> : null}
          <span className={s.text}>{norm.name}</span>
        </div>
      </div>
    );
  }

  // Снаружи нет <Link> — можно честный <a>
  return (
    <div className={containerClass} title={norm.name}>
      {link ? (
        <a className={s.inner} href={link} target="_blank" rel="noopener noreferrer">
          {norm.logo ? <img className={s.logo} src={norm.logo} alt={norm.name} /> : null}
          <span className={s.text}>{norm.name}</span>
        </a>
      ) : (
        <div className={s.inner}>
          {norm.logo ? <img className={s.logo} src={norm.logo} alt={norm.name} /> : null}
          <span className={s.text}>{norm.name}</span>
        </div>
      )}
    </div>
  );
}
