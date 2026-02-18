// Путь: frontend/src/components/SmartMedia.jsx
// Назначение: Универсальный компонент изображения/аудио с безопасными фолбэками.
// Изменения (FIX v2025-12-21):
//   ✅ Автоматически исправляет "битые" базы URL (localhost/127.0.0.1) на текущий домен сайта
//   ✅ Автоматически апгрейдит http -> https для картинок на этом же домене (убирает Mixed Content)
//   ✅ Нормализует относительные пути (/media/..., /static/...) в абсолютные на текущий origin
//   ✅ Сохраняет прежнюю логику ресайзера (/api/media/thumbnail/...) и плейсхолдера
//   ✅ Аудио никогда не отправляет в ресайзер

import React, { useMemo, useState } from "react";
import s from "./SmartMedia.module.css";
import {
  buildThumbnailUrl,
  buildThumbnailOrPlaceholder,
  isAudioUrl,
  DEFAULT_NEWS_PLACEHOLDER,
} from "../Api";

function getPageOrigin() {
  try {
    if (typeof window !== "undefined" && window.location && window.location.origin) {
      return window.location.origin;
    }
  } catch {}
  return "";
}

function looksLikeLocalhost(url) {
  try {
    return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\b/i.test(String(url || ""));
  } catch {
    return false;
  }
}

function normalizeAnyUrl(input) {
  if (!input) return "";
  const s = String(input);

  // data/blob/about — не трогаем
  if (/^(data:|blob:|about:)/i.test(s)) return s;

  const origin = getPageOrigin();

  // //example.com/img.jpg → https://example.com/img.jpg (по текущему протоколу)
  if (/^\/\//.test(s) && typeof window !== "undefined") {
    return `${window.location.protocol}${s}`;
  }

  // /media/.. или /static/.. → https://site.com/media/..
  if (s.startsWith("/") && origin) {
    return `${origin}${s}`;
  }

  // http(s)://... → как есть, но:
  // 1) если это localhost/127 — переписываем на текущий origin, сохраняя path+query
  // 2) если страница https и url http на этом же домене — апгрейдим до https
  try {
    const u = new URL(s, origin || undefined);

    if (origin && looksLikeLocalhost(u.href)) {
      // сохраняем только путь+параметры от "локалхоста", но отправляем на текущий домен
      const fixed = new URL(u.pathname + u.search + u.hash, origin);
      return fixed.href;
    }

    if (origin) {
      const page = new URL(origin);
      if (page.protocol === "https:" && u.protocol === "http:" && u.host === page.host) {
        u.protocol = "https:";
        return u.href;
      }
    }

    return u.href;
  } catch {
    // на крайний случай возвращаем исходное
    return s;
  }
}

function rewriteLocalhostInResizerUrl(resizerUrl) {
  // Если ресайзер сгенерировался как http://127.0.0.1:8000/api/media/thumbnail/?...
  // переписываем на https://текущий-домен/api/media/thumbnail/?...
  const origin = getPageOrigin();
  if (!origin) return resizerUrl || "";
  if (!resizerUrl) return "";

  try {
    const u = new URL(String(resizerUrl));
    if (!looksLikeLocalhost(u.href)) return normalizeAnyUrl(u.href);

    const fixed = new URL(u.pathname + u.search + u.hash, origin);
    return fixed.href;
  } catch {
    // если url относительный — normalizeAnyUrl сам поднимет
    return normalizeAnyUrl(resizerUrl);
  }
}

/**
 * Props:
 *  - src: исходный URL медиа
 *  - alt: alt текст для <img>
 *  - className: классы для <img> или <audio>
 *  - thumb: опции ресайзера { w, h, q, fmt, fit }
 *  - preferOriginal: не использовать ресайзер, показывать оригинал (для логотипов и т.п.)
 *  - loading: "lazy" | "eager"
 *  - sizes: <img sizes>
 *  - onClick: обработчик клика по медиа
 */
export default function SmartMedia({
  src,
  alt = "Изображение",
  className = "",
  thumb = { w: 1200, h: 630, q: 85, fmt: "webp", fit: "cover" },
  preferOriginal = false,
  loading = "lazy",
  sizes,
  onClick,
  style,
  imgProps = {},
  audioProps = {},
}) {
  const [failed, setFailed] = useState(false);

  const kind = useMemo(() => {
    if (!src) return "image";
    return isAudioUrl(src) ? "audio" : "image";
  }, [src]);

  const computedSrc = useMemo(() => {
    if (failed) return DEFAULT_NEWS_PLACEHOLDER;

    if (kind === "audio") {
      // аудио никогда не отправляем в ресайзер
      return normalizeAnyUrl(src || "");
    }

    const normalizedOriginal = normalizeAnyUrl(src || "");

    if (preferOriginal) {
      // показываем оригинальную картинку как есть, но при ошибке упадём на плейсхолдер
      return normalizedOriginal || DEFAULT_NEWS_PLACEHOLDER;
    }

    // картинка через ресайзер; если ресайзер не подходит — вернётся плейсхолдер
    let viaResizer = "";
    try {
      viaResizer = buildThumbnailUrl(normalizedOriginal, thumb) || "";
    } catch {
      viaResizer = "";
    }

    const fixedResizer = rewriteLocalhostInResizerUrl(viaResizer);
    if (fixedResizer) return fixedResizer;

    try {
      const altUrl = buildThumbnailOrPlaceholder(normalizedOriginal, thumb);
      return normalizeAnyUrl(altUrl || DEFAULT_NEWS_PLACEHOLDER);
    } catch {
      return DEFAULT_NEWS_PLACEHOLDER;
    }
  }, [failed, kind, preferOriginal, src, thumb]);

  if (kind === "audio") {
    return (
      <audio
        className={`${s.audio} ${className || ""}`.trim()}
        controls
        src={computedSrc || ""}
        {...audioProps}
      />
    );
  }

  return (
    <img
      className={`${s.img} ${className || ""}`.trim()}
      src={computedSrc}
      alt={alt}
      loading={loading}
      sizes={sizes}
      style={style}
      onClick={onClick}
      onError={() => setFailed(true)}
      {...imgProps}
    />
  );
}
