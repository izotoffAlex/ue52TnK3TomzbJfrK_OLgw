/* Путь: frontend/src/components/zen/PreviewModal.jsx
   Назначение: Модал предпросмотра. Исправлен рендер списков/чеклистов, картинок/таблиц.
*/

import React from "react";
import "./PreviewModal.css";

export default function PreviewModal({ open, onClose, title, cover, html, contentJson }) {
  if (!open) return null;

  const safe = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));

  function renderBlocks(json) {
    if (!json || !Array.isArray(json.blocks)) return "";

    const parts = json.blocks.map((block) => {
      const { type, data = {} } = block || {};
      switch (type) {
        case "header": {
          const lvl = Math.min(Math.max(parseInt(data.level || 2, 10), 1), 6);
          return `<h${lvl} class="pm-h${lvl}">${safe(data.text)}</h${lvl}>`;
        }
        case "paragraph":
          return `<p>${safe(data.text)}</p>`;
        case "list": {
          const tag = data.style === "ordered" ? "ol" : "ul";
          const items = (data.items || [])
            .map((it) => `<li>${safe(typeof it === "string" ? it : it?.text)}</li>`)
            .join("");
          return `<${tag}>${items}</${tag}>`;
        }
        case "checklist": {
          const items = (data.items || [])
            .map((it) => {
              const txt = safe(typeof it === "string" ? it : it?.text);
              const checked = !!it?.checked;
              return `<li class="pm-checkitem ${checked ? "checked" : ""}">
                        <span class="pm-check">${checked ? "✓" : ""}</span>
                        <span>${txt}</span>
                      </li>`;
            })
            .join("");
          return `<ul class="pm-checklist">${items}</ul>`;
        }
        case "quote": {
          const text = safe(data.text);
          const cap = data.caption ? `<div class="caption">${safe(data.caption)}</div>` : "";
          return `<blockquote><p>${text}</p>${cap}</blockquote>`;
        }
        case "delimiter":
          return `<div class="ce-delimiter"></div>`;
        case "image": {
          const url = data.file?.url || data.url || data.src;
          if (!url) return "";
          const cap = data.caption ? `<figcaption>${safe(data.caption)}</figcaption>` : "";
          const alt = safe(data.caption || "");
          return `<figure class="preview-image">
                    <img src="${url}" alt="${alt}" />
                    ${cap}
                  </figure>`;
        }
        case "table": {
          const rows = (data.content || data.rows || [])
            .map((row) => `<tr>${(row || []).map((cell) => `<td>${safe(cell)}</td>`).join("")}</tr>`)
            .join("");
          return `<div class="preview-table-wrap"><table>${rows}</table></div>`;
        }
        case "embed": {
          const src = data.embed || data.source || data.url;
          if (!src) return "";
          const cap = data.caption ? `<figcaption>${safe(data.caption)}</figcaption>` : "";
          return `<figure class="preview-embed"><iframe src="${src}" allowfullscreen></iframe>${cap}</figure>`;
        }
        default:
          return "";
      }
    });

    return parts.join("\n");
  }

  const articleHtml = html || renderBlocks(contentJson);

  return (
    <div className="pm-backdrop" onClick={onClose}>
      <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-head">
          <div className="pm-title">Предпросмотр</div>
          <button className="pm-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <article className="pm-article">
          {title ? <h1 className="pm-h1">{title}</h1> : null}
          {cover ? (
            <div className="pm-cover">
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img src={cover} />
            </div>
          ) : null}
          <div className="pm-content" dangerouslySetInnerHTML={{ __html: articleHtml }} />
        </article>
      </div>
    </div>
  );
}
