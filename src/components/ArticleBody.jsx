// Путь: frontend/src/components/ArticleBody.jsx
// Назначение: Безопасный рендер HTML-текста статьи. Автоматически:
//   • находит все <img> и <picture><source>, нормализует относительные ссылки через baseUrl,
//   • проксирует через /api/media/thumbnail/ (fit=contain, без кропа),
//   • включает lazy-loading/async decode,
//   • ставит красивый SVG-плейсхолдер при любой ошибке,
//   • убирает слушатели событий при обновлении (без утечек).
// Использование:
//   <ArticleBody html={article.body || article.content_html} baseUrl={article.source_url} />
//
// Зависимости: buildThumbUrl из frontend/src/utils/thumb.js

import React, { useEffect, useRef } from "react";
import { buildThumbUrl } from "../utils/thumb";

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675'>
       <defs>
         <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
           <stop offset='0%' stop-color='#0a0f1a'/>
           <stop offset='100%' stop-color='#1b2440'/>
         </linearGradient>
       </defs>
       <rect fill='url(#g)' width='100%' height='100%'/>
       <g fill='#5a6b84' font-family='Arial, Helvetica, sans-serif'>
         <rect x='578' y='250' width='44' height='44' rx='6' fill='none' stroke='#5a6b84' stroke-width='2'/>
         <path d='M584 282 l10-12 10 8 12-14 8 10 v8 z' fill='#5a6b84'/>
         <text x='50%' y='80%' dominant-baseline='middle' text-anchor='middle' font-size='18'>Изображение недоступно</text>
       </g>
     </svg>`
  );

// Построение прокси-URL для body-изображений: вписывание без кропа
function toProxy(src, opts = {}) {
  const { w = 1200, h = 1600, fmt = "webp", fit = "contain", q = 82, sharpen = 1 } = opts;
  if (!src) return "";
  // не проксируем уже-проксированное
  if (String(src).includes("/api/media/thumbnail/")) return src;
  return buildThumbUrl(src, { w, h, fmt, fit, q, sharpen });
}

function resolveUrlMaybeRelative(src, baseUrl) {
  if (!src) return "";
  try {
    const s = String(src).trim();
    if (!s) return "";
    if (s.startsWith("data:") || s.includes("/api/media/thumbnail/")) return s;
    if (/^https?:\/\//i.test(s)) return s;
    if (baseUrl) return new URL(s, baseUrl).toString();
    return s;
  } catch {
    return src;
  }
}

// Разбор srcset: берём первый кандидат (простая и быстрая стратегия)
function firstFromSrcset(srcset) {
  if (!srcset) return "";
  const first = String(srcset).split(",")[0]?.trim().split(" ")[0] || "";
  return first;
}

export default function ArticleBody({
  html = "",
  baseUrl = "",
  className = "",
}) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const onErrorHandlers = [];

    // Универсальный навес ошибки с отпиской
    const attachErrorHandler = (img) => {
      const handler = () => {
        img.removeAttribute("srcset");
        img.setAttribute("src", PLACEHOLDER);
      };
      img.addEventListener("error", handler);
      onErrorHandlers.push(() => img.removeEventListener("error", handler));
    };

    // 1) <img ...>
    const imgs = root.querySelectorAll("img");
    imgs.forEach((img) => {
      // поддержим разные lazy-атрибуты
      let original =
        img.getAttribute("src") ||
        img.getAttribute("data-src") ||
        img.getAttribute("data-original") ||
        img.getAttribute("data-lazy") ||
        "";

      original = resolveUrlMaybeRelative(original, baseUrl);

      if (original && !original.includes("/api/media/thumbnail/")) {
        const proxied = toProxy(original, { w: 1200, h: 1600, fit: "contain", fmt: "webp", q: 82, sharpen: 1 });
        if (proxied) {
          img.setAttribute("src", proxied);
          const proxied2x = toProxy(original, { w: 2000, h: 2000, fit: "contain", fmt: "webp", q: 82, sharpen: 1 });
          img.setAttribute("srcset", `${proxied} 1x, ${proxied2x} 2x`);
          img.setAttribute("sizes", "(max-width: 1200px) 100vw, 1200px");
        }
      }

      // Ещё один формат ленивой загрузки — data-srcset
      const dss = img.getAttribute("data-srcset");
      if (dss && !img.getAttribute("src")) {
        const first = firstFromSrcset(dss);
        const abs = resolveUrlMaybeRelative(first, baseUrl);
        const prox = toProxy(abs, { w: 1200, h: 1600, fit: "contain" });
        if (prox) img.setAttribute("src", prox);
        img.removeAttribute("data-srcset");
      }

      // базовая гигиена
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      img.style.maxWidth = "100%";
      img.style.height = "auto";

      attachErrorHandler(img);
    });

    // 2) <picture><source srcset=...> — подменим srcset первого кандидата
    const sources = root.querySelectorAll("picture source[srcset], picture source[data-srcset]");
    sources.forEach((source) => {
      const ss = source.getAttribute("srcset") || source.getAttribute("data-srcset") || "";
      const first = firstFromSrcset(ss);
      const abs = resolveUrlMaybeRelative(first, baseUrl);
      const prox = toProxy(abs, { w: 1600, h: 1600, fit: "contain" });
      if (prox) {
        source.setAttribute("srcset", prox);
        source.removeAttribute("data-srcset");
      }
    });

    // 3) почистим агрессивные инлайновые стили
    root.querySelectorAll("img[style]").forEach((img) => {
      img.style.maxWidth = "100%";
      img.style.height = "auto";
    });

    // cleanup: снимем обработчики onerror при обновлении html/baseUrl
    return () => {
      onErrorHandlers.forEach((off) => {
        try { off(); } catch {}
      });
    };
  }, [html, baseUrl]);

  return (
    <div
      ref={ref}
      className={className}
      // HTML приходит из CMS/импортёра и «чинится» в useEffect
      dangerouslySetInnerHTML={{ __html: html || "" }}
    />
  );
}
