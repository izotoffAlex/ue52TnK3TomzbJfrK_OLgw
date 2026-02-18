// Путь: frontend/src/utils/thumb.js
// Назначение: формирует URL к ресайзеру /api/media/thumbnail/ и вспомогательные утилиты для изображений.
// Работает и в dev (frontend:3000 → backend:8000), и в prod (один домен с /api).
// Использование:
//   import { thumbUrl, buildThumbUrl, thumbSrcSet, resolveImageUrl, PLACEHOLDER } from "../utils/thumb";
//   const url = thumbUrl(src, { w, h, q, fmt, fit, sharpen });
//   const url2 = buildThumbUrl(src, { w, h, q, fmt, fit, sharpen }); // алиас thumbUrl (совместимость с моими примерами)
//   const { srcset, sizes } = thumbSrcSet(src, { w: 640, h: 360 });
//   const abs = resolveImageUrl("/img/pic.jpg", "https://source.example/page.html");
//
// Обновлено:
//   ✅ НЕ УДАЛЯЕТ существующую функцию thumbUrl — только дополнил поддержкой параметра `sharpen`
//   ✅ Добавлены buildThumbUrl (алиас), resolveImageUrl (нормализация относительных URL), thumbSrcSet (ретина srcset)
//   ✅ Добавлен PLACEHOLDER — красивый SVG data: на случай onError в <img> (можно использовать где угодно)

function apiOrigin() {
  // 1) Явно заданный origin в .env
  const env =
    (process.env.REACT_APP_API_ORIGIN || process.env.REACT_APP_BACKEND_ORIGIN || "").trim();
  if (env) return env.replace(/\/$/, "");

  // 2) Пытаемся угадать: если фронт крутится на :3000, считаем бэкенд :8000
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (port === "3000") return `${protocol}//${hostname}:8000`;
    // иначе тот же домен (обычно /api проксируется веб-сервером)
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }

  // 3) Фолбэк
  return "http://localhost:8000";
}

/**
 * Сформировать URL миниатюры ресайзера.
 * src — абсолютный URL или относительный путь в MEDIA_ROOT ("/uploads/...")
 * Параметры:
 *   w, h — размер, q — качество (40..95), fmt — webp/jpeg/jpg/png/avif, fit — cover|contain
 *   sharpen — 0..2 (0=нет, 1=умеренно, 2=сильнее) — поддерживается бэкендом.
 */
export function thumbUrl(
  src,
  { w = 480, h = 270, q = 72, fmt = "webp", fit = "cover", sharpen = 1 } = {}
) {
  if (!src) return "";
  // Если уже проксированный URL — возвращаем как есть
  try {
    const test = String(src);
    if (test.includes("/api/media/thumbnail/")) return test;
  } catch {
    /* no-op */
  }

  const base = apiOrigin();
  const u = new URL("/api/media/thumbnail/", base);
  u.searchParams.set("src", src);
  u.searchParams.set("w", String(w));
  u.searchParams.set("h", String(h));
  u.searchParams.set("q", String(q));
  u.searchParams.set("fmt", fmt);
  u.searchParams.set("fit", fit);
  // добавляем sharpen, если передали (по умолчанию 1)
  if (typeof sharpen !== "undefined" && sharpen !== null) {
    u.searchParams.set("sharpen", String(sharpen));
  }
  return u.toString();
}

/**
 * Алиас для совместимости с компонентами и примерами кода: buildThumbUrl(...) == thumbUrl(...)
 */
export function buildThumbUrl(src, opts = {}) {
  return thumbUrl(src, opts);
}

/**
 * Нормализует относительный src картинки относительно baseUrl (URL источника статьи),
 * безопасно обходит data: и уже-проксированные ссылки.
 */
export function resolveImageUrl(src, baseUrl) {
  if (!src) return "";
  const s = String(src);
  if (s.startsWith("data:") || s.includes("/api/media/thumbnail/")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  try {
    if (baseUrl) return new URL(s, baseUrl).toString();
  } catch {
    /* no-op */
  }
  return s;
}

/**
 * Готовит srcset для ретины (1x/2x) через наш ресайзер.
 * Возвращает объект { src, srcset, sizes }.
 */
export function thumbSrcSet(
  src,
  { w = 640, h = 360, fmt = "webp", fit = "cover", q = 82, sharpen = 1 } = {}
) {
  const src1x = thumbUrl(src, { w, h, fmt, fit, q, sharpen });
  const src2x = thumbUrl(src, { w: Math.round(w * 1.6), h: Math.round(h * 1.6), fmt, fit, q, sharpen });
  return {
    src: src1x,
    srcset: `${src1x} 1x, ${src2x} 2x`,
    sizes: `(max-width: ${w}px) 100vw, ${w}px`,
  };
}

/**
 * Красивый SVG плейсхолдер (data:) для onError в <img>.
 * Можно использовать напрямую: <img onError={(e)=> e.currentTarget.src=PLACEHOLDER} ... />
 */
export const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'>
       <defs>
         <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
           <stop offset='0%' stop-color='#0a0f1a'/>
           <stop offset='100%' stop-color='#1b2440'/>
         </linearGradient>
       </defs>
       <rect fill='url(#g)' width='100%' height='100%'/>
       <g fill='#5a6b84' font-family='Arial, Helvetica, sans-serif'>
         <rect x='298' y='120' width='44' height='44' rx='6' fill='none' stroke='#5a6b84' stroke-width='2'/>
         <path d='M304 152 l10-12 10 8 12-14 8 10 v8 z' fill='#5a6b84'/>
         <text x='50%' y='78%' dominant-baseline='middle' text-anchor='middle' font-size='16'>Нет изображения</text>
       </g>
     </svg>`
  );
