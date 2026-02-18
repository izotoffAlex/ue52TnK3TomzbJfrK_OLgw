// Путь: frontend/src/api/auth.js
// Назначение: Обёртка для регистрации пользователя через эндпоинт /api/auth/register/.
// Изменения:
//   ✅ Исправлена сборка URL: больше НЕ будет /api/api/... при REACT_APP_API_BASE="/api"
//   ✅ Безопасный default: если env не задан — используем same-origin (пустая база)
//   ✅ Улучшена диагностика ошибок: показываем понятное сообщение + HTTP-статус

const RAW_API_BASE = process.env.REACT_APP_API_BASE;

/**
 * Нормализуем базу:
 * - ""  -> same-origin
 * - "/api" -> остаётся "/api"
 * - "https://site.ru/" -> "https://site.ru"
 */
function normalizeBase(raw) {
  let base = (raw ?? "").trim();
  if (!base) return "";
  base = base.replace(/\/+$/, ""); // убираем хвостовые /
  return base;
}

/**
 * Строим URL для регистрации так, чтобы корректно работало во всех вариантах:
 * 1) API_BASE=""                      -> "/api/auth/register/"
 * 2) API_BASE="/api"                  -> "/api/auth/register/"   (без дубля)
 * 3) API_BASE="https://izotovlife.ru" -> "https://izotovlife.ru/api/auth/register/"
 * 4) API_BASE="https://izotovlife.ru/api" -> "https://izotovlife.ru/api/auth/register/" (без дубля)
 * 5) API_BASE="http://localhost:8000" -> "http://localhost:8000/api/auth/register/"
 */
function getRegisterUrl() {
  const base = normalizeBase(RAW_API_BASE);

  if (!base) return "/api/auth/register/";

  // если база уже заканчивается на /api — НЕ добавляем ещё раз /api
  if (base.endsWith("/api")) return `${base}/auth/register/`;

  // если база == "/api" — тоже не удваиваем
  if (base === "/api") return "/api/auth/register/";

  return `${base}/api/auth/register/`;
}

/**
 * Достаём человекочитаемую ошибку из DRF/Allauth-ответов
 */
function extractErrorMessage(data, fallback) {
  if (!data) return fallback;

  // самые частые форматы
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;

  // DRF field errors: { email: ["..."], password: ["..."] }
  const fieldOrder = ["email", "username", "password", "first_name", "last_name", "non_field_errors"];
  for (const k of fieldOrder) {
    const v = data[k];
    if (Array.isArray(v) && v.length) return String(v[0]);
    if (typeof v === "string") return v;
  }

  // иногда приходит { errors: {...} }
  if (data.errors && typeof data.errors === "object") {
    for (const k of Object.keys(data.errors)) {
      const v = data.errors[k];
      if (Array.isArray(v) && v.length) return String(v[0]);
      if (typeof v === "string") return v;
    }
  }

  return fallback;
}

/**
 * Регистрация пользователя.
 * payload:
 * { first_name: string, last_name: string, email: string, password: string }
 */
export async function register(payload) {
  const url = getRegisterUrl();

  // чтобы не получить CORS-401/403 на абсолютных URL (credentials+cors),
  // используем cookies только для относительных запросов (same-origin).
  const isAbsolute = /^https?:\/\//i.test(url);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: isAbsolute ? "omit" : "same-origin",
    body: JSON.stringify(payload),
  });

  // читаем тело безопасно (json может не прийти)
  const txt = await res.text().catch(() => "");
  let data = null;
  try {
    data = txt ? JSON.parse(txt) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg = extractErrorMessage(data, "Ошибка регистрации. Проверьте корректность полей.");
    throw new Error(`${msg} (HTTP ${res.status})`);
  }

  return data || { detail: "OK" };
}


