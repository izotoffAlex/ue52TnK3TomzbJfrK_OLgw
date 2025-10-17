// Путь: frontend/src/components/OptimizedCardImage.jsx
// Назначение: Быстрая картинка для карточек ленты (миниатюры через /api/media/thumbnail/ с фолбэком).
// Обновления (добавлено, ничего существующее не удалено):
//   ✅ Мгновенное скрытие <img> при ошибке (чтобы альт-текст не «выпрыгивал» даже на долю секунды).
//   ✅ Новый проп hideOnError (по умолчанию true); логика переключения thumb → original → placeholder сохранена.
//   ✅ Остальные фичи без изменений: eager, preconnect к хосту ресайзера, таймер переключения, srcset/sizes.

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { thumbUrl } from "../utils/thumb";

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#0b0d11"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#5a6b84" font-family="Arial" font-size="16">Нет изображения</text></svg>'
  );

const DEFAULT_TIMEOUT = 2000;
const EAGER_TIMEOUT = 800;

function ensurePreconnect(url) {
  try {
    const u = new URL(url);
    const origin = `${u.protocol}//${u.host}`;
    const id = `preconnect-${u.host}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "preconnect";
    link.href = origin;
    link.crossOrigin = "";
    document.head.appendChild(link);
  } catch {}
}

export default function OptimizedCardImage({
  src,
  alt = "",
  className = "",
  aspectW = 16,
  aspectH = 9,
  eager = false,       // ← как и было
  hideOnError = true,  // ← НОВОЕ: мгновенно скрывать текущий <img> при ошибке (убирает «альт-фликер»)
}) {
  const [mode, setMode] = useState("thumb"); // "thumb" | "original" | "placeholder"
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef(null);
  const imgRef = useRef(null);               // ← держим ссылку на текущий <img>

  const base = useMemo(() => {
    if (!src) return null;
    const h = (w) => Math.max(1, Math.round((w * aspectH) / aspectW));
    const t320 = thumbUrl(src, { w: 320, h: h(320) });
    const t480 = thumbUrl(src, { w: 480, h: h(480) });
    const t640 = thumbUrl(src, { w: 640, h: h(640) });
    ensurePreconnect(t480);
    return { 320: t320, 480: t480, 640: t640 };
  }, [src, aspectW, aspectH]);

  const srcSet =
    mode === "thumb" && base
      ? `${base[320]} 320w, ${base[480]} 480w, ${base[640]} 640w`
      : undefined;

  const loadingAttr = eager ? "eager" : "lazy";
  const fetchPriority = eager ? "high" : "low";
  const switchTimeout = eager ? EAGER_TIMEOUT : DEFAULT_TIMEOUT;

  const style = {
    aspectRatio: `${aspectW} / ${aspectH}`,
    width: "100%",
    height: "auto",
    display: "block",
    background: loaded ? "transparent" : "#0b0d11",
    borderRadius: 12,
  };

  useEffect(() => {
    setLoaded(false);
    if (!src) {
      setMode("placeholder");
      return;
    }
    setMode("thumb");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setMode((m) => (m === "thumb" ? "original" : m));
    }, switchTimeout);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [src, switchTimeout]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleError = useCallback(
    (e) => {
      // 🔧 КРИТИЧЕСКОЕ: мгновенно скрываем текущий <img>, чтобы не было «битой иконки» и выпадения alt-текста.
      if (hideOnError && e?.currentTarget) {
        try {
          e.currentTarget.style.display = "none";
        } catch {}
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      setLoaded(false);
      setMode((m) => (m === "thumb" ? "original" : "placeholder"));
    },
    [hideOnError]
  );

  if (!src || mode === "placeholder") {
    // Для плейсхолдера alt не нужен — это декоративная заглушка
    return (
      <img
        className={className}
        src={PLACEHOLDER}
        alt=""
        style={style}
        loading="lazy"
        decoding="async"
        fetchpriority="low"
        aria-hidden="true"
      />
    );
  }

  if (mode === "original") {
    return (
      <img
        ref={imgRef}
        className={className}
        src={src}
        alt={alt}
        style={style}
        loading={loadingAttr}
        decoding="async"
        fetchpriority={fetchPriority}
        onLoad={handleLoad}
        onError={handleError}
      />
    );
  }

  // mode === "thumb"
  return (
    <img
      ref={imgRef}
      className={className}
      src={base ? base[480] : src}
      srcSet={srcSet}
      sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw"
      alt={alt}
      loading={loadingAttr}
      decoding="async"
      fetchpriority={fetchPriority}
      onLoad={handleLoad}
      onError={handleError}
      style={style}
    />
  );
}
