// Путь: frontend/src/utils/thumb.js
// Назначение: формирует URL к ресайзеру /api/media/thumbnail/
// Работает и в dev (frontend:3000 → backend:8000), и в prod (один домен с /api).
// Использование: import { thumbUrl } from "../utils/thumb";  thumbUrl(src, { w, h, q, fmt, fit })

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

export function thumbUrl(
  src,
  { w = 480, h = 270, q = 72, fmt = "webp", fit = "cover" } = {}
) {
  if (!src) return "";
  const base = apiOrigin();
  const u = new URL("/api/media/thumbnail/", base);
  u.searchParams.set("src", src);
  u.searchParams.set("w", String(w));
  u.searchParams.set("h", String(h));
  u.searchParams.set("q", String(q));
  u.searchParams.set("fmt", fmt);
  u.searchParams.set("fit", fit);
  return u.toString();
}
