// Путь: frontend/src/Api.js
// Назначение: Axios-инстанс и все функции API (новости, категории, поиск,
//             избранное, аутентификация, метрики, служебные патчи).
//
// FIX (2026-02-15):
// ✅ Авторизация: поддержка JWT и "token key" (DRF TokenAuthentication) через один localStorage ключ.
// ✅ Заголовок Authorization ставится корректно: Bearer <jwt> или Token <key>.
// ✅ 401-retry interceptor НЕ повторяет запросы логина (иначе получались дубли 401).
// ✅ Переход в Django-admin использует абсолютный BACKEND origin (в dev иначе улетали на :3002).
// ✅ Убраны ESLint no-unused-vars для _packPagedPayload/_hasValidImageLite/_fetchHomeFeed (экспортированы в __internal).

import axios from "axios";

/* ---------------- LOCAL DEV DETECT ---------------- */
// FIX 2026-02-05: в локалке React (localhost:3000/3002) и Django (127.0.0.1:8000) — разные origin.
// При withCredentials=true браузер требует CORS+credentials, и XHR (axios) может падать "Network Error".
// Решение: в DEV отключаем withCredentials, в PROD оставляем включенным.
const IS_DEV =
  typeof window !== "undefined" &&
  (window.location?.hostname === "localhost" ||
    window.location?.hostname === "127.0.0.1");

/* ---------------- БАЗА И ИНСТАНС ---------------- */
export const API_BASE = (
  process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000/api"
).replace(/\/$/, "");

// 🔗 Фронтендные урлы для совместимости со старыми компонентами (например, FavoriteHeart)
export const FRONTEND_BASE_URL =
  (typeof window !== "undefined" && window.location?.origin) ||
  process.env.REACT_APP_FRONTEND_BASE_URL ||
  "http://localhost:3000";
export const FRONTEND_LOGIN_URL =
  process.env.REACT_APP_FRONTEND_LOGIN_URL || "/login";

/**
 * BACKEND_ORIGIN — нужен, чтобы уходить в Django-admin в DEV.
 * В DEV baseURL у axios = "/api" (через CRA proxy), а window.location.origin = :3002,
 * поэтому относительный "/admin/..." откроется на React dev server.
 *
 * Можно задать явно:
 *   REACT_APP_BACKEND_ORIGIN=http://127.0.0.1:8000
 * Если не задан — пытаемся вывести из API_BASE.
 */
const BACKEND_ORIGIN =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_BACKEND_ORIGIN) ||
  (() => {
    try {
      return new URL(API_BASE).origin;
    } catch {
      return "";
    }
  })();

function toAbsoluteBackendUrl(maybeUrl) {
  const u = String(maybeUrl || "").trim();
  if (!u) return null;

  // Уже абсолютный
  if (/^https?:\/\//i.test(u)) return u;

  // Относительный: делаем абсолютным через BACKEND_ORIGIN (если задан)
  if (u.startsWith("/")) {
    if (!BACKEND_ORIGIN) return u; // fallback (в проде может быть тот же origin)
    return BACKEND_ORIGIN.replace(/\/+$/, "") + u;
  }

  // "admin/..." без ведущего /
  if (BACKEND_ORIGIN)
    return (
      BACKEND_ORIGIN.replace(/\/+$/, "") + "/" + u.replace(/^\/+/, "")
    );

  return u;
}

const api = axios.create({
  baseURL: IS_DEV ? "/api" : API_BASE,
  withCredentials: !IS_DEV,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

// совместимость со старыми импортами
export { api as http };

/* ---------------- ТЕСТОВАЯ ЛЕНТА (ФОЛБЭК) ---------------- */
const TEST_FEED = [
  {
    id: 10001,
    slug: "test-1-vilfand-teplie-vyhodnye",
    title: "Вильфанд: ближайшие выходные в Москве будут тёплыми",
    summary: "Синоптик порадовал хорошими новостями: бабье лето затянулось.",
    source: { name: "tass.ru", slug: "tass" },
    category: { name: "Общество", slug: "obshchestvo" },
    url: "#",
    image: null,
    published_at: new Date().toISOString(),
  },
  {
    id: 10002,
    slug: "test-2-berzon-black-friday",
    title: "Экономист Берзон: «Не покупайте лишнее в чёрную пятницу»",
    summary: "Скидки манят, но бюджет благодарит дисциплину.",
    source: { name: "rt.com", slug: "rt" },
    category: { name: "Экономика", slug: "ekonomika" },
    url: "#",
    image: null,
    published_at: new Date().toISOString(),
  },
  {
    id: 10003,
    slug: "test-3-astor-mirage-ukraine",
    title: "Макрон: Франция поставит Украине ракеты Aster и истребители Mirage",
    summary: "Политические заявления недели — в одной новости.",
    source: { name: "rt.com", slug: "rt" },
    category: { name: "Политика", slug: "politika" },
    url: "#",
    image: null,
    published_at: new Date().toISOString(),
  },
  {
    id: 10004,
    slug: "test-4-parkovka-krysha",
    title: "На вокзале Петербурга крыша парковки рухнула на платформу",
    summary: "Инцидент без пострадавших, ведётся проверка.",
    source: { name: "rg.ru", slug: "rg" },
    category: { name: "Происшествия", slug: "proisshestviya" },
    url: "#",
    image: null,
    published_at: new Date().toISOString(),
  },
  {
    id: 10005,
    slug: "test-5-kpr-modernizacia-teploseti",
    title: "КНР получит 1 млрд ₽ на модернизацию теплосетей",
    summary: "Финансирование направят в 2025–2026 годах.",
    source: { name: "tass.ru", slug: "tass" },
    category: { name: "Экономика", slug: "ekonomika" },
    url: "#",
    image: null,
    published_at: new Date().toISOString(),
  },
  {
    id: 10006,
    slug: "test-6-gorky-park",
    title: "Золотая осень в Москве: кадры из Парка Горького",
    summary: "Фотопрогулка по городу: пока листья не улетели.",
    source: { name: "izotovlife", slug: "izotovlife" },
    category: { name: "Без категории", slug: "bez-kategorii" },
    url: "#",
    image: null,
    published_at: new Date().toISOString(),
  },
];

function shouldUseFakeFeed() {
  try {
    const ls = localStorage.getItem("useFakeFeed") === "1";
    const url = new URL(window.location.href);
    const qp = url.searchParams.get("fake") === "1";
    return ls || qp;
  } catch {
    return false;
  }
}

function paginate(arr, page = 1, pageSize = 20) {
  const p = Math.max(1, Number(page) || 1);
  const s = Math.max(1, Number(pageSize) || 20);
  const from = (p - 1) * s;
  return arr.slice(from, from + s);
}

/* ---------------- JWT УТИЛИТЫ ---------------- */
function parseJwt(token) {
  try {
    const [, payload] = token.split(".");
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isJwtValid(token) {
  const p = parseJwt(token);
  if (!p || !p.exp) return false;
  return p.exp > Date.now() / 1000 + 5;
}

/* ---------------- ТОКЕНЫ (JWT + DRF Token key) ---------------- */
/**
 * FIX: раньше setToken принимал только JWT и всегда ставил Bearer.
 * Теперь поддерживаем:
 *  - JWT -> "Authorization: Bearer <jwt>"
 *  - token key -> "Authorization: Token <key>" (DRF TokenAuthentication) [web:310]
 */
function looksLikeJwt(token) {
  const t = String(token || "").trim();
  return t.split(".").length === 3;
}

function applyAuthHeader(token) {
  const t = String(token || "").trim();
  if (!t) return;

  api.defaults.headers.common["Authorization"] = looksLikeJwt(t)
    ? `Bearer ${t}`
    : `Token ${t}`;
}

function dropToken() {
  try {
    localStorage.removeItem("access");
  } catch {}
  delete api.defaults.headers.common["Authorization"];
}

export function setToken(token) {
  const t = String(token || "").trim();
  if (!t) {
    dropToken();
    return;
  }

  // JWT проверяем exp, token key — не проверяем
  if (looksLikeJwt(t) && !isJwtValid(t)) {
    dropToken();
    return;
  }

  try {
    localStorage.setItem("access", t);
  } catch {}

  applyAuthHeader(t);
}

// восстановление токена при старте
try {
  const saved = localStorage.getItem("access");
  if (saved) {
    if (looksLikeJwt(saved) && !isJwtValid(saved)) dropToken();
    else applyAuthHeader(saved);
  } else {
    dropToken();
  }
} catch {}

/* ---------------- ОБЩИЕ УТИЛИТЫ ---------------- */
export function normalizeSlug(raw) {
  if (!raw) return raw;
  let v = String(raw).trim();
  try {
    v = decodeURIComponent(v);
  } catch {}
  v = v
    .replace(/[?#].*$/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/[-/]+$/g, "");
  return v.trim();
}

export function slugCandidates(raw) {
  if (!raw) return [];
  const t = String(raw).trim().replace(/[-/]+$/g, "");
  const norm = normalizeSlug(t);
  return Array.from(new Set([norm, t])).filter(Boolean);
}

// Прямые и обратные алиасы (канон → старые формы)
const SLUG_ALIASES = {
  obschestvo: "obshchestvo",
  "lenta-novostej": "lenta-novostey",
  proisshestvija: "proisshestviya",
};

const SLUG_BACK = {
  obshchestvo: ["obschestvo"],
  "lenta-novostey": ["lenta-novostej"],
  proisshestviya: ["proisshestvija"],
};

export function canonSlug(slug) {
  const s = normalizeSlug(slug);
  return SLUG_ALIASES[s] || s;
}

function backAliases(slug) {
  const s = canonSlug(slug);
  return SLUG_BACK[s] ? [s, ...SLUG_BACK[s]] : [s];
}

/** attachSeoUrl(obj)
 * Добавляет поле seo_url для удобной навигации на фронте.
 * Ничего не ломает, работает идемпотентно.
 */
export function attachSeoUrl(obj = {}, type = "") {
  try {
    if (!obj || obj.seo_url) return obj;

    const cat =
      (obj.category && obj.category.slug) ||
      (Array.isArray(obj.categories) &&
        obj.categories[0] &&
        obj.categories[0].slug) ||
      obj.category_slug ||
      null;

    const base = cat ? `/${cat}` : "/news";

    if (obj.slug) {
      obj.seo_url = `${base}/${obj.slug}/`;
    } else if (obj.title) {
      obj.seo_url = `${base}/${encodeURIComponent(
        String(obj.title).toLowerCase().replace(/\s+/g, "-")
      )}/`;
    }
  } catch {}
  return obj;
}

/* ---------------- ПЛЕЙСХОЛДЕР И РЕСАЙЗЕР ---------------- */
export const DEFAULT_NEWS_PLACEHOLDER = "";

const AUDIO_EXT = [".mp3", ".ogg", ".wav", ".m4a", ".aac", ".flac"];

export function isAudioUrl(url) {
  if (!url) return false;
  const u = String(url).toLowerCase().split("?")[0];
  return AUDIO_EXT.some((ext) => u.endsWith(ext));
}

function isHttpLike(url) {
  return /^https?:\/\//i.test(String(url));
}

function isDataOrBlob(url) {
  return /^(data:|blob:|about:)/i.test(String(url || ""));
}

/**
 * Возвращает набор "своих" хостов (куда ресайзер разрешает абсолютные URL).
 * Логика:
 *  - текущий фронтенд-домен (window.location.hostname)
 *  - домен API_BASE (например izotovlife.ru)
 *  - домен DJ_BASE (API_BASE без /api)
 */
function getOwnHostSet() {
  const set = new Set();
  try {
    if (typeof window !== "undefined" && window.location?.hostname) {
      set.add(String(window.location.hostname).toLowerCase());
    }
  } catch {}

  try {
    const apiHost = new URL(API_BASE).hostname.toLowerCase();
    if (apiHost) set.add(apiHost);
  } catch {}

  try {
    const DJ_BASE = API_BASE.replace(/\/api\/?$/, "");
    const djHost = new URL(DJ_BASE).hostname.toLowerCase();
    if (djHost) set.add(djHost);
  } catch {}

  return set;
}

function isOwnAbsoluteUrl(absUrl) {
  try {
    const host = new URL(String(absUrl)).hostname.toLowerCase();
    if (!host) return false;
    const own = getOwnHostSet();
    return own.has(host);
  } catch {
    return false;
  }
}

// ⚙️ Обновлено: поддержка относительных путей к медиа с Django (/media/...)
// ✅ внешние absolute URL НЕ отправляем в ресайзер (иначе backend отдаёт 400)
export function buildThumbnailUrl(
  src,
  { w = 640, h = 360, q = 82, fmt = "webp", fit = "cover" } = {}
) {
  if (!src) return null;
  if (isAudioUrl(src)) return null;
  if (isDataOrBlob(src)) return src;

  // База сайта без /api на конце
  const DJ_BASE = API_BASE.replace(/\/api\/?$/, "");

  let absoluteSrc = String(src);

  if (isHttpLike(absoluteSrc)) {
    // ✅ если абсолютный URL и он НЕ нашего домена — показываем напрямую, без ресайзера
    if (!isOwnAbsoluteUrl(absoluteSrc)) {
      return absoluteSrc;
    }
    // иначе (свой домен) — можно в ресайзер
  } else if (/^\/?media\//i.test(absoluteSrc)) {
    absoluteSrc = `${DJ_BASE}/${absoluteSrc.replace(/^\/+/, "")}`;
  } else {
    // не http и не /media/... — возвращаем как есть (часто это уже готовый путь)
    return absoluteSrc;
  }

  const base = `${API_BASE}/media/thumbnail/`;
  const params = new URLSearchParams({
    src: absoluteSrc,
    w: String(w),
    h: String(h),
    q: String(q),
    fmt,
    fit,
  });
  return `${base}?${params.toString()}`;
}

export const buildThumb = buildThumbnailUrl;

export function buildThumbnailOrPlaceholder(url, opts) {
  // ВАЖНО: никаких заглушек. Нет картинки -> null (и тогда <img> не рисуем).
  const u = String(url || "").trim();
  if (!u) return null;
  const built = buildThumbnailUrl(u, opts);
  return built || null;
}

/* ---------------- ТИХИЕ tryGet / tryPost ---------------- */
const QUIET_STATUSES = new Set([400, 401, 404, 405]);
const DEBUG_API = (() => {
  try {
    return localStorage.getItem("debugApi") === "1";
  } catch {
    return false;
  }
})();

export async function tryGet(paths, config = {}) {
  const list =
    typeof paths === "string"
      ? [paths]
      : Array.isArray(paths)
      ? paths
      : [];
  let lastErr = null;
  for (const p of list) {
    try {
      return await api.get(p, config);
    } catch (e) {
      const st = e?.response?.status;
      if (DEBUG_API) console.warn("tryGet fail:", p, st || e?.message);
      if (QUIET_STATUSES.has(st)) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  if (lastErr) throw lastErr;
  throw new Error("Все варианты путей вернули ошибку");
}

export async function tryPost(paths, data = {}, config = {}) {
  const list =
    typeof paths === "string"
      ? [paths]
      : Array.isArray(paths)
      ? paths
      : [];
  let lastErr = null;
  for (const p of list) {
    try {
      return await api.post(p, data, config);
    } catch (e) {
      const st = e?.response?.status;
      if (DEBUG_API) console.warn("tryPost fail:", p, st || e?.message);
      if (QUIET_STATUSES.has(st)) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  if (lastErr) throw lastErr;
  throw new Error("Все варианты POST-путей вернули ошибку");
}

/* ---------------- УМНЫЙ REQUEST-ИНТЕРСЕПТОР AXIOS ---------------- */
function _absUrlFromConfig(cfg) {
  const base = (cfg?.baseURL || API_BASE).replace(/\/+$/, "");
  const url = String(cfg?.url || "");
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
}

function _isEmptyRelatedUrl(u) {
  try {
    const x = new URL(u);
    const path = x.pathname.replace(/\/+$/, "/");
    return /\/api\/news\/related\/$/i.test(path) && !x.searchParams.has("slug");
  } catch {
    return false;
  }
}

function _noToken() {
  try {
    return !localStorage.getItem("access");
  } catch {
    return true;
  }
}

function _localOkResponseAdapter(data, cfg) {
  return async () => ({
    data,
    status: 200,
    statusText: "OK",
    headers: { "x-local": "1" },
    config: cfg,
    request: null,
  });
}

function _rewriteCategoryUrlSmart(u) {
  try {
    const x = new URL(u);
    const path = x.pathname.replace(/\/+$/, "/");
    const qs = x.searchParams;

    // Не трогаем корректный related
    if (/\/api\/news\/related\/$/i.test(path)) return u;

    // FIX: /api/news/ -> /api/news/home-feed/
    if ((path === "/api/news/" || path === "/api/news") && !qs.has("category")) {
      x.pathname = "/api/news/home-feed/";
      return x.toString();
    }

    if (path.endsWith("/api/news/") && qs.has("category")) {
      const s = qs.get("category") || "";
      const [canon, legacy] = backAliases(s);
      const page = qs.get("page") || "1";
      const ps = qs.get("page_size") || qs.get("limit") || "20";
      if (legacy && legacy !== canon) {
        return `${API_BASE}/news/${encodeURIComponent(
          legacy
        )}/?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(
          ps
        )}&page_size=${encodeURIComponent(ps)}`;
      }
      return `${API_BASE}/news/category/${encodeURIComponent(
        canon
      )}/?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(
        ps
      )}&page_size=${encodeURIComponent(ps)}`;
    }

    const m1 = path.match(/\/api\/categories\/([^/]+)\/news\/$/i);
    if (m1) {
      const s = decodeURIComponent(m1[1]);
      const [canon, legacy] = backAliases(s);
      const page = qs.get("page") || "1";
      const ps = qs.get("page_size") || "20";
      if (legacy && legacy !== canon) {
        return `${API_BASE}/news/${encodeURIComponent(
          legacy
        )}/?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(
          ps
        )}&page_size=${encodeURIComponent(ps)}`;
      }
      return `${API_BASE}/news/category/${encodeURIComponent(
        canon
      )}/?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(
        ps
      )}&page_size=${encodeURIComponent(ps)}`;
    }

    const m2 = path.match(/\/api\/category\/([^/]+)\/$/i);
    if (m2) {
      const s = decodeURIComponent(m2[1]);
      const [canon, legacy] = backAliases(s);
      const page = qs.get("page") || "1";
      const ps = qs.get("page_size") || qs.get("limit") || "20";
      if (legacy && legacy !== canon) {
        return `${API_BASE}/news/${encodeURIComponent(
          legacy
        )}/?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(
          ps
        )}&page_size=${encodeURIComponent(ps)}`;
      }
      return `${API_BASE}/news/category/${encodeURIComponent(
        canon
      )}/?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(
        ps
      )}&page_size=${encodeURIComponent(ps)}`;
    }

    const m3 = path.match(/\/api\/news\/category\/([^/]+)\/$/i);
    if (m3) {
      const s = decodeURIComponent(m3[1]);
      const [canon, legacy] = backAliases(s);
      if (legacy && legacy !== canon) {
        const page = qs.get("page") || "1";
        const ps = qs.get("page_size") || "20";
        return `${API_BASE}/news/${encodeURIComponent(
          legacy
        )}/?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(
          ps
        )}&page_size=${encodeURIComponent(ps)}`;
      }
      return u;
    }

    // 1) /api/news/news/ → /api/news/category/news/
    if (/\/api\/news\/news\/$/i.test(path)) {
      const page = qs.get("page") || "1";
      const ps = qs.get("page_size") || qs.get("limit") || "20";
      return `${API_BASE}/news/category/news/?page=${encodeURIComponent(
        page
      )}&limit=${encodeURIComponent(ps)}&page_size=${encodeURIComponent(ps)}`;
    }

    // 2) /api/news/check[/<slug>]/ → /api/news/favorites/check/?slug=...
    if (/\/api\/news\/check\/?$/i.test(path)) {
      const slug = qs.get("slug") || "";
      return slug
        ? `${API_BASE}/news/favorites/check/?slug=${encodeURIComponent(slug)}`
        : `${API_BASE}/news/favorites/check/`;
    }
    const mChkNews = path.match(/\/api\/news\/check\/([^/]+)\/?$/i);
    if (mChkNews) {
      const slug = decodeURIComponent(mChkNews[1]);
      return `${API_BASE}/news/favorites/check/?slug=${encodeURIComponent(
        slug
      )}`;
    }

    // 3) /api/favorites/check[/<slug>]/ → /api/news/favorites/check/?slug=...
    if (/\/api\/favorites\/check\/?$/i.test(path)) {
      const slug = qs.get("slug") || "";
      return slug
        ? `${API_BASE}/news/favorites/check/?slug=${encodeURIComponent(slug)}`
        : `${API_BASE}/news/favorites/check/`;
    }
    const mChk = path.match(/\/api\/favorites\/check\/([^/]+)\/?$/i);
    if (mChk) {
      const slug = decodeURIComponent(mChk[1]);
      return `${API_BASE}/news/favorites/check/?slug=${encodeURIComponent(
        slug
      )}`;
    }

    // 4) /api/news/favorites/check/<slug>/ → query
    const mNFChk = path.match(/\/api\/news\/favorites\/check\/([^/]+)\/?$/i);
    if (mNFChk) {
      const slug = decodeURIComponent(mNFChk[1]);
      return `${API_BASE}/news/favorites/check/?slug=${encodeURIComponent(
        slug
      )}`;
    }

    // 5) toggle → всегда query-форма
    if (/\/api\/favorites\/toggle\/?$/i.test(path)) {
      const slug = qs.get("slug");
      return slug
        ? `${API_BASE}/news/favorites/toggle/?slug=${encodeURIComponent(slug)}`
        : `${API_BASE}/news/favorites/toggle/`;
    }
    const mTgl = path.match(/\/api\/favorites\/toggle\/([^/]+)\/?$/i);
    if (mTgl) {
      const slug = decodeURIComponent(mTgl[1]);
      return `${API_BASE}/news/favorites/toggle/?slug=${encodeURIComponent(
        slug
      )}`;
    }
    const mNFTgl = path.match(/\/api\/news\/favorites\/toggle\/([^/]+)\/?$/i);
    if (mNFTgl) {
      const slug = decodeURIComponent(mNFTgl[1]);
      return `${API_BASE}/news/favorites/toggle/?slug=${encodeURIComponent(
        slug
      )}`;
    }

    return u;
  } catch {
    return u;
  }
}

api.interceptors.request.use(
  (config) => {
    const abs = _absUrlFromConfig(config);

    // Если отправляем FormData, убираем принудительный JSON Content-Type
    const isFD =
      typeof FormData !== "undefined" && config?.data instanceof FormData;
    if (isFD && config.headers) {
      if (config.headers["Content-Type"]) delete config.headers["Content-Type"];
      if (config.headers["content-type"]) delete config.headers["content-type"];
    }

    // Пустой related → сразу локальный ответ []
    if (_isEmptyRelatedUrl(abs)) {
      config.adapter = _localOkResponseAdapter([], config);
      return config;
    }

    // Для гостей — локальные ответы по whoami и favorites
    if (_noToken()) {
      if (/\/api\/auth\/whoami\/$/i.test(abs) || /\/api\/users\/me\/$/i.test(abs)) {
        config.adapter = _localOkResponseAdapter(
          { is_authenticated: false, user: null },
          config
        );
        return config;
      }
      if (
        /\/api\/news\/favorites\/check\/?/i.test(abs) ||
        /\/api\/favorites\/check\/?/i.test(abs) ||
        /\/api\/news\/check\/?/i.test(abs)
      ) {
        config.adapter = _localOkResponseAdapter({ is_favorite: false }, config);
        return config;
      }
      if (
        /\/api\/news\/favorites\/(toggle|)$/i.test(abs) ||
        /\/api\/favorites\/toggle\/?/i.test(abs)
      ) {
        config.adapter = _localOkResponseAdapter({ is_favorite: false }, config);
        return config;
      }
    }

    const rewritten = _rewriteCategoryUrlSmart(abs);

    if (rewritten !== abs) {
      config.baseURL = "";
      config.url = rewritten;

      if (typeof rewritten === "string" && rewritten.includes("?")) {
        config.params = {}; // глушим дубли
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ---------------- FIX: НОРМАЛИЗАЦИЯ DRF pagination (next/previous) ---------------- */
function _paginationNormalizeLink(link) {
  if (!link) return null;

  let origin = "https://izotovlife.ru";
  try {
    origin =
      (typeof window !== "undefined" && window.location?.origin) ||
      new URL(API_BASE).origin ||
      origin;
  } catch {}

  try {
    const u = new URL(String(link), origin);
    let path = (u.pathname || "") + (u.search || "");

    if (path.startsWith("/api/")) path = path.slice(4);

    return path || null;
  } catch {
    let s = String(link || "");

    if (/^https?:\/\//i.test(s)) {
      try {
        const u2 = new URL(s);
        s = (u2.pathname || "") + (u2.search || "");
      } catch {}
    }

    if (s.startsWith("/api/")) s = s.slice(4);
    if (!s) return null;
    return s;
  }
}

api.interceptors.response.use(
  (response) => {
    try {
      const d = response?.data;

      if (d && typeof d === "object" && ("next" in d || "previous" in d)) {
        const nextAbs = d.next ?? null;
        const prevAbs = d.previous ?? null;

        response.data = {
          ...d,
          next: _paginationNormalizeLink(nextAbs),
          previous: _paginationNormalizeLink(prevAbs),
          next_absolute: nextAbs,
          previous_absolute: prevAbs,
        };
      }
    } catch {}
    return response;
  },
  async (err) => {
    const status = err?.response?.status;
    const config = err?.config || {};

    // FIX: НЕ делаем retry на логине, иначе получается дубль 401 и путаница.
    const abs = _absUrlFromConfig(config);
    const isLogin = /\/api\/auth\/login\/$/i.test(abs);

    if (status === 401 && !config._retry && !isLogin) {
      dropToken();
      config._retry = true;
      if (config.headers) {
        delete config.headers["Authorization"];
        delete config.headers.authorization;
      }
      try {
        return await api.request(config);
      } catch (e) {
        return Promise.reject(e);
      }
    }

    return Promise.reject(err);
  }
);

/* ---------------- ЛЕНТА ---------------- */
function extractFeedList(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;

  if (
    payload.results &&
    typeof payload.results === "object" &&
    !Array.isArray(payload.results)
  ) {
    for (const v of Object.values(payload.results)) {
      if (Array.isArray(v) && v.length) return v;
    }
  }

  if (Array.isArray(payload.items)) return payload.items;

  if (
    payload.items &&
    typeof payload.items === "object" &&
    !Array.isArray(payload.items)
  ) {
    for (const v of Object.values(payload.items)) {
      if (Array.isArray(v) && v.length) return v;
    }
  }

  if (Array.isArray(payload.data)) return payload.data;

  if (
    payload.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
  ) {
    for (const v of Object.values(payload.data)) {
      if (Array.isArray(v) && v.length) return v;
    }
  }

  if (payload && typeof payload === "object") {
    for (const v of Object.values(payload)) {
      if (Array.isArray(v) && v.length) return v;
    }
  }

  return [];
}

export async function fetchNews(page = 1, page_size = 20) {
  if (shouldUseFakeFeed()) {
    return paginate(TEST_FEED, page, page_size).map((n) => attachSeoUrl(n));
  }

  try {
    const primaryResponse = await tryGet(
      ["/news/home-feed/", "/news/feed/", "/news/"],
      { params: { page, page_size } }
    );

    let data = extractFeedList(primaryResponse.data);

    if (!Array.isArray(data) || data.length === 0) {
      try {
        const fallbackResponse = await api.get("/news/home-feed/", {
          params: { page, page_size },
        });
        data = extractFeedList(fallbackResponse.data);
      } catch {}
    }

    if (!Array.isArray(data) || data.length === 0) {
      return paginate(TEST_FEED, page, page_size).map((n) => attachSeoUrl(n));
    }

    return data.map((n) => attachSeoUrl(n));
  } catch {
    return paginate(TEST_FEED, page, page_size).map((n) => attachSeoUrl(n));
  }
}

/** Упаковывает paginated-пейлоад, не теряя метаданные. */
function _packPagedPayload(payload, results, { page, page_size }) {
  const p = payload && typeof payload === "object" ? payload : {};

  const safePageSize = Math.max(1, Number(page_size) || 20);
  const safeCount =
    typeof p.count === "number"
      ? p.count
      : Array.isArray(results)
      ? results.length
      : 0;

  const safePages =
    typeof p.pages === "number" && p.pages > 0
      ? p.pages
      : safeCount
      ? Math.ceil(safeCount / safePageSize)
      : 0;

  return {
    ...p,
    count: safeCount,
    next: "next" in p ? p.next : null,
    previous: "previous" in p ? p.previous : null,
    page: typeof p.page === "number" ? p.page : Number(page) || 1,
    pages: safePages,
    page_size:
      typeof p.page_size === "number" && p.page_size > 0
        ? p.page_size
        : safePageSize,
    results: Array.isArray(results) ? results : [],
  };
}

/** Мягкая проверка "есть ли картинка". */
function _hasValidImageLite(n) {
  const img =
    n?.image ||
    n?.image_url ||
    n?.imageUrl ||
    n?.cover_image ||
    n?.preview_image ||
    n?.thumbnail ||
    n?.thumb ||
    n?.thumb_url ||
    n?.picture ||
    n?.photo ||
    n?.img ||
    n?.og_image ||
    n?.og_image_url;

  if (!img) return false;

  const sImg = String(img).trim();
  if (!sImg) return false;

  if (sImg.includes("default_news.svg")) return false;
  if (sImg.toLowerCase() === "null") return false;

  return true;
}

/** Новая "истина" для главной ленты. */
async function _fetchHomeFeed({ page = 1, page_size = 30, _ts } = {}) {
  const params = {
    page,
    page_size,
    _ts: _ts !== undefined ? _ts : Date.now(),
  };
  const r = await api.get("/news/home-feed/", { params });
  return r.data;
}

// Чтобы ESLint не ругался на "defined but never used"
export const __internal = { _packPagedPayload, _hasValidImageLite, _fetchHomeFeed };

export async function fetchNewsFeedText({ page = 1, page_size = 30 } = {}) {
  if (shouldUseFakeFeed()) {
    const results = paginate(TEST_FEED, page, page_size).map(attachSeoUrl);
    return { count: TEST_FEED.length, next: null, previous: null, results, page, page_size };
  }

  try {
    const r = await api.get("/news/feed/text/", { params: { page, page_size } });
    const payload = r.data;

    if (Array.isArray(payload)) {
      const results = payload.map(attachSeoUrl);
      return { count: results.length, next: null, previous: null, results, page, page_size };
    }

    const resultsRaw = extractFeedList(payload);
    const results = Array.isArray(resultsRaw) ? resultsRaw.map(attachSeoUrl) : [];

    return {
      count:
        typeof payload?.count === "number"
          ? payload.count
          : Array.isArray(payload?.results)
          ? payload.results.length
          : results.length,
      next: payload?.next ?? null,
      previous: payload?.previous ?? null,
      page: payload?.page ?? page,
      pages: payload?.pages ?? payload?.num_pages ?? null,
      page_size: payload?.page_size ?? page_size,
      results,
      with_images: Array.isArray(payload?.with_images)
        ? payload.with_images.map(attachSeoUrl)
        : undefined,
      without_images: Array.isArray(payload?.without_images)
        ? payload.without_images.map(attachSeoUrl)
        : undefined,
      next_absolute: payload?.next_absolute,
      previous_absolute: payload?.previous_absolute,
    };
  } catch {
    const results = paginate(TEST_FEED, page, page_size).map(attachSeoUrl);
    return { count: TEST_FEED.length, next: null, previous: null, results, page, page_size };
  }
}

export async function fetchNewsFeedImages({ page = 1, page_size = 20 } = {}) {
  if (shouldUseFakeFeed()) {
    const results = paginate(TEST_FEED, page, page_size).map(attachSeoUrl);
    return { count: TEST_FEED.length, next: null, previous: null, results, page, page_size };
  }

  try {
    const r = await api.get("/news/feed/images/", { params: { page, page_size } });
    const payload = r.data;

    if (Array.isArray(payload)) {
      const results = payload.map(attachSeoUrl);
      return { count: results.length, next: null, previous: null, results, page, page_size };
    }

    const resultsRaw = extractFeedList(payload);
    const results = Array.isArray(resultsRaw) ? resultsRaw.map(attachSeoUrl) : [];

    return {
      count:
        typeof payload?.count === "number"
          ? payload.count
          : Array.isArray(payload?.results)
          ? payload.results.length
          : results.length,
      next: payload?.next ?? null,
      previous: payload?.previous ?? null,
      page: payload?.page ?? page,
      pages: payload?.pages ?? payload?.num_pages ?? null,
      page_size: payload?.page_size ?? page_size,
      results,
      with_images: Array.isArray(payload?.with_images)
        ? payload.with_images.map(attachSeoUrl)
        : undefined,
      without_images: Array.isArray(payload?.without_images)
        ? payload.without_images.map(attachSeoUrl)
        : undefined,
      next_absolute: payload?.next_absolute,
      previous_absolute: payload?.previous_absolute,
    };
  } catch {
    const results = paginate(TEST_FEED, page, page_size).map(attachSeoUrl);
    return { count: TEST_FEED.length, next: null, previous: null, results, page, page_size };
  }
}

/* ---------------- КАТЕГОРИИ ---------------- */
export async function fetchCategories() {
  try {
    const r = await tryGet(["/categories/", "/news/categories/", "/news/category-list/"]);
    const data = r.data;

    if (Array.isArray(data)) return data;
    if (Array.isArray(data.results)) return data.results;

    if (data && typeof data === "object" && data.results) {
      if (Array.isArray(data.results)) return data.results;
      if (typeof data.results === "object") {
        const vals = Object.values(data.results);
        if (vals.length && Array.isArray(vals[0])) return vals[0];
      }
    }

    if (DEBUG_API) console.warn("fetchCategories: неожиданный формат", data);
    return [];
  } catch {
    return [];
  }
}

export async function fetchCategoryCovers() {
  try {
    const r = await api.get("/categories/covers/");
    const data = r.data;

    if (Array.isArray(data)) {
      const m = {};
      for (const x of data) {
        if (x && x.slug) m[x.slug] = x.image || "";
      }
      return m;
    }

    if (data && typeof data === "object") return data;
    return {};
  } catch {
    return {};
  }
}

export async function fetchFirstImageForCategory(slug) {
  if (!slug) return null;
  const s = canonSlug(slug);

  try {
    const r = await api.get("/news/feed/images/", { params: { category: s, limit: 1 } });

    const raw =
      r.data?.items ||
      r.data?.results ||
      (Array.isArray(r.data) ? r.data : []);

    const first = Array.isArray(raw) ? raw[0] : null;
    if (!first) return null;

    const src =
      first.image ||
      first.cover_image ||
      first.cover ||
      first.image_url ||
      first.thumbnail ||
      null;

    return src || null;
  } catch {
    return null;
  }
}

/* ---------- ПРЕДОХРАНИТЕЛЬ ПО КАТЕГОРИЯМ ---------- */
const CAT_STOP_KEY = "CAT_STOP_AFTER_V1";

function _readCatStop() {
  try {
    const raw = sessionStorage.getItem(CAT_STOP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function _writeCatStop(map) {
  try {
    sessionStorage.setItem(CAT_STOP_KEY, JSON.stringify(map));
  } catch {}
}

let CAT_STOP_AFTER = _readCatStop();

function getCatStop(slug) {
  const s = canonSlug(slug);
  return Number(CAT_STOP_AFTER[s] || 0);
}

function setCatStop(slug, pageNum) {
  const s = canonSlug(slug);
  const prev = Number(CAT_STOP_AFTER[s] || 0);
  if (pageNum > prev) {
    CAT_STOP_AFTER[s] = pageNum;
    _writeCatStop(CAT_STOP_AFTER);
  }
}

// Категорийная лента: Article + ImportedNews по slug категории.
// Для авторской категории дальше уже фильтруем на фронте по type === "article".
export async function fetchCategoryNews(slug, opts = 1) {
  if (!slug) return [];

  const page = typeof opts === "number" ? opts : Number(opts?.page || 1);
  const limitIn =
    typeof opts === "object" && opts?.limit ? Number(opts.limit) : undefined;
  const limit = limitIn ?? 20;

  const s = canonSlug(slug);

  const stopAfter = getCatStop(s);
  if (stopAfter && page > stopAfter) return [];

  const unpack = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.items)) return data.items;
    if (data?.results?.results && Array.isArray(data.results.results))
      return data.results.results;
    if (data && typeof data === "object") {
      const vals = Object.values(data);
      if (vals.length && Array.isArray(vals[0])) return vals[0];
    }
    return [];
  };

  // Тестовый фид оставляем без изменений
  if (shouldUseFakeFeed()) {
    const filtered = TEST_FEED.filter(
      (i) => (i.category?.slug || "").toLowerCase() === s.toLowerCase()
    );
    const arr = filtered.length ? filtered : TEST_FEED;
    const paged = paginate(arr, page, limit).map(attachSeoUrl);
    if (paged.length < limit) setCatStop(s, page);
    return paged;
  }

  // 1) Правильный категорийный эндпоинт backend-а
  try {
    const r = await api.get(`/news/category/${s}/`, {
      params: { page, page_size: limit },
    });
    const list = unpack(r.data);
    if (Array.isArray(list)) {
      if (list.length < limit) setCatStop(s, page);
      return list.map(attachSeoUrl);
    }
  } catch (e) {
    console.error("fetchCategoryNews /news/category/ error", e);
  }

  // 2) Если что-то пошло не так — мягко останавливаемся,
  // чтобы не долбить backend бесконечно.
  setCatStop(s, page);
  return [];
}


/* ---------------- ПОИСК ---------------- */
export async function searchAll(query, { limit = 30, offset = 0 } = {}) {
  if (!query) return { items: [], total: 0 };
  try {
    const r = await api.get("/news/search/", { params: { q: query, limit, offset } });
    const items = r.data.results || r.data.items || [];
    return { items: items.map(attachSeoUrl), total: r.data.count ?? items.length };
  } catch {
    return { items: [], total: 0 };
  }
}

export async function fetchSmartSearch(query) {
  if (!query || query.length < 2) return [];
  try {
    const r = await api.get("/news/search/smart/", { params: { q: query }, timeout: 5000 });
    const results = Array.isArray(r.data?.results)
      ? r.data.results
      : Array.isArray(r.data)
      ? r.data
      : [];
    return results.map(attachSeoUrl);
  } catch {
    return [];
  }
}

/* ---------------- РЕЗОЛВЕР И СТАТЬИ ---------------- */
export async function resolveNews(slug) {
  if (!slug) throw new Error("resolveNews: пустой slug");
  const norm = normalizeSlug(slug);
  const r = await tryGet([
    `/news/resolve/${encodeURIComponent(norm)}/`,
    `/news/by-slug/${encodeURIComponent(norm)}/`,
  ]);
  return r.data;
}
export { resolveNews as resolveNewsApi };

export async function fetchArticle(arg1, arg2) {
  let category = null,
    slug = null;

  if (typeof arg1 === "string" && typeof arg2 !== "string") {
    slug = arg1;
  } else if (typeof arg1 === "object" && arg1 !== null) {
    category = arg1.category || null;
    slug = arg1.slug || arg1.seo_slug || arg1.url_slug || null;
  } else {
    category = arg1 || null;
    slug = arg2 || null;
  }

  if (!slug) throw new Error("fetchArticle: нужен slug");

  const cands = slugCandidates(slug);

  try {
    const resolved = await resolveNews(cands[0] || slug);
    const detail = resolved?.detail_url;
    if (detail) {
      const r = await api.get(detail);
      return attachSeoUrl(r.data, "article");
    }
  } catch {}

  const directPaths = [
    ...cands.map((s) => `/news/${encodeURIComponent(s)}/`),
    ...cands.map((s) => `/article/${encodeURIComponent(s)}/`),
  ];

  if (category) {
    const cat = encodeURIComponent(String(category));
    for (const s of cands) {
      directPaths.push(`/news/${cat}/${encodeURIComponent(s)}/`);
      directPaths.push(`/news/article/${cat}/${encodeURIComponent(s)}/`);
    }
  }

  const r = await tryGet(directPaths);
  return attachSeoUrl(r.data, "article");
}

export async function fetchImportedNews(source, slug) {
  if (!source || !slug) throw new Error("fetchImportedNews: нужен source && slug");
  const cands = slugCandidates(slug);
  const r = await tryGet(
    cands.map(
      (s) => `/news/rss/${encodeURIComponent(source)}/${encodeURIComponent(s)}/`
    )
  );
  return attachSeoUrl(r.data, "rss");
}

/* ---------------- ПОХОЖИЕ НОВОСТИ ---------------- */
export async function fetchRelated(...args) {
  let slug = null,
    limit = 6;

  if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
    slug = args[0].slug;
    if (args[0].limit != null) limit = args[0].limit;
  } else if (args.length >= 1 && typeof args[0] === "string") {
    slug = args[0];
    if (typeof args[1] === "number") limit = args[1];
  }

  let legacy = null;
  if (!slug && args.length >= 3) {
    const [, param, legacySlug] = args;
    legacy = { param, slug: legacySlug };
    slug = legacySlug;
  }

  if (!slug) return [];

  const cands = slugCandidates(slug);
  const pathsPref = [
    ...cands.map((s) => `/news/${encodeURIComponent(s)}/related/`),
    ...cands.map((s) => `/news/related/${encodeURIComponent(s)}/`),
    "/news/related/",
  ];

  try {
    const r = await tryGet(pathsPref, { params: { slug: cands[0], limit } });
    const data = r.data?.results || r.data || [];
    return Array.isArray(data) ? data.map(attachSeoUrl) : data;
  } catch {}

  if (legacy && legacy.param) {
    const rssPaths = cands.map(
      (s) =>
        `/news/rss/${encodeURIComponent(legacy.param)}/${encodeURIComponent(
          s
        )}/related/`
    );
    const articlePaths = cands.map(
      (s) =>
        `/news/article/${encodeURIComponent(legacy.param)}/${encodeURIComponent(
          s
        )}/related/`
    );
    const universalPaths = cands.map(
      (s) =>
        `/news/${encodeURIComponent(legacy.param)}/${encodeURIComponent(
          s
        )}/related/`
    );
    const r2 = await tryGet([...articlePaths, ...rssPaths, ...universalPaths], {
      params: { limit },
    });
    const data2 = r2.data?.results || r2.data || [];
    return Array.isArray(data2) ? data2.map(attachSeoUrl) : data2;
  }

  return [];
}

/* ---------------- ИЗБРАННОЕ ---------------- */
function _hasToken() {
  try {
    return !!localStorage.getItem("access");
  } catch {
    return false;
  }
}

export async function favoritesCheck(slug) {
  if (!slug) return false;
  if (!_hasToken()) return false;
  try {
    const r = await tryGet(
      [
        `/news/favorites/${encodeURIComponent(slug)}/check/`,
        `/news/favorites/check/${encodeURIComponent(slug)}/`,
        `/news/favorites/check/`,
        `/favorites/${encodeURIComponent(slug)}/check/`,
        `/favorites/check/${encodeURIComponent(slug)}/`,
        `/favorites/check/`,
        `/news/check/`,
      ],
      { params: { slug } }
    );
    return !!(r.data && (r.data.is_favorite || r.data.favorite));
  } catch (e) {
    if (e?.response?.status === 401) return false;
    return false;
  }
}

export async function favoritesToggle(slug) {
  if (!slug) return { is_favorite: false };
  if (!_hasToken()) return { is_favorite: false };
  try {
    const r = await tryPost(
      [
        `/news/favorites/${encodeURIComponent(slug)}/toggle/`,
        "/news/favorites/toggle/",
        "/news/favorites/",
        `/favorites/${encodeURIComponent(slug)}/toggle/`,
        "/favorites/toggle/",
        "/favorites/",
      ],
      { slug }
    );
    return r.data || { is_favorite: false };
  } catch (e) {
    if (e?.response?.status === 401) return { is_favorite: false };
    throw e;
  }
}

/* ---------------- МЕТРИКИ ---------------- */
export async function hitMetrics(type, slug) {
  try {
    const normType = type === "a" ? "article" : type === "i" ? "rss" : type;
    const cands = slugCandidates(slug);
    const s = cands[0] || normalizeSlug(slug);
    const r = await api.post("/news/metrics/hit/", { type: normType, slug: s });
    return r.data;
  } catch (e) {
    const st = e?.response?.status;
    if (st !== 404 && DEBUG_API) console.warn("metrics/hit warn:", st || e?.message);
    return null;
  }
}

/* ---------------- СТРАНИЦЫ ---------------- */
export async function fetchPages() {
  try {
    const r = await api.get("/pages/");
    return r.data;
  } catch {
    return [];
  }
}

export async function fetchPage(slug) {
  try {
    const r = await api.get(`/pages/${slug}/`);
    return r.data;
  } catch {
    return null;
  }
}

/* ---------------- ПРЕДЛОЖИТЬ НОВОСТЬ ---------------- */
const SUGGEST_NEWS_TIMEOUT_MS_TEXT = 15000;
const SUGGEST_NEWS_TIMEOUT_MS_UPLOAD = 180000;

export async function suggestNews(payload) {
  try {
    const isFD = typeof FormData !== "undefined" && payload instanceof FormData;

    if (isFD) {
      const r1 = await api.post("/news/suggest/", payload, {
        timeout: SUGGEST_NEWS_TIMEOUT_MS_UPLOAD,
      });
      return r1.data;
    }

    const p = payload && typeof payload === "object" ? payload : {};

    const hasFile =
      (typeof File !== "undefined" &&
        (p.image_file instanceof File || p.video_file instanceof File)) ||
      (p.image_file && typeof p.image_file === "object" && "size" in p.image_file) ||
      (p.video_file && typeof p.video_file === "object" && "size" in p.video_file) ||
      (p.files &&
        typeof p.files === "object" &&
        typeof p.files.length === "number" &&
        Number(p.files.length) > 0);

    if (hasFile) {
      const fd = new FormData();
      const appendIf = (k, v) => {
        if (v != null && v !== "") fd.append(k, v);
      };

      appendIf("first_name", p.first_name);
      appendIf("last_name", p.last_name);
      appendIf("email", p.email);
      appendIf("phone", p.phone);
      appendIf("title", p.title);
      appendIf("message", p.message);
      appendIf("website", p.website);

      try {
        if (p.files && typeof p.files.length === "number") {
          for (let i = 0; i < p.files.length; i++) {
            const f = p.files[i];
            if (f) fd.append("files", f);
          }
        }
      } catch {}

      if (p.image_file) {
        fd.append("image_file", p.image_file);
        fd.append("image", p.image_file);
        fd.append("photo", p.image_file);
      }
      if (p.video_file) {
        fd.append("video_file", p.video_file);
        fd.append("video", p.video_file);
      }

      if (typeof p.recaptcha === "string" && p.recaptcha.trim()) {
        fd.append("captcha", p.recaptcha);
        fd.append("recaptcha", p.recaptcha);
        fd.append("g-recaptcha-response", p.recaptcha);
      }

      const r2 = await api.post("/news/suggest/", fd, {
        timeout: SUGGEST_NEWS_TIMEOUT_MS_UPLOAD,
      });
      return r2.data;
    }

    const body = { ...p };
    if (
      typeof p.recaptcha === "string" &&
      p.recaptcha.trim() &&
      !("captcha" in body) &&
      !("g-recaptcha-response" in body)
    ) {
      body.captcha = p.recaptcha;
      body["g-recaptcha-response"] = p.recaptcha;
    }
    const r3 = await api.post("/news/suggest/", body, {
      timeout: SUGGEST_NEWS_TIMEOUT_MS_TEXT,
    });
    return r3.data;
  } catch (e) {
    if (e.response?.data) throw e.response.data;
    throw new Error(e.message || "Network error");
  }
}

/* ---------------- АУТЕНТИФИКАЦИЯ ---------------- */
export async function login(username, password) {
  const bodies = [
    { username, password },
    { email: username, password },
    { email: username, username, password },
  ];

  let r = null;
  let lastErr = null;

  for (const body of bodies) {
    try {
      r = await tryPost(["/auth/login/"], body);
      break;
    } catch (e) {
      lastErr = e;
      const st = e?.response?.status;
      if (st === 400 || st === 401) continue;
      throw e;
    }
  }

  if (!r) throw lastErr || new Error("Login failed");

  const token =
    r.data?.access ||
    r.data?.access_token ||
    r.data?.auth_token ||
    r.data?.key ||
    r.data?.token;

  if (token) setToken(token);

  return r.data;
}

export async function whoami() {
  const hasToken =
    !!localStorage.getItem("access") ||
    !!localStorage.getItem("key") ||
    !!localStorage.getItem("token") ||
    !!localStorage.getItem("auth_token");

  if (!hasToken) return null;

  try {
    const r = await tryGet([
      "/auth/me/",
      "/auth/whoami/",
      "/users/me/",
      "/auth/user/",
    ]);
    return r.data;
  } catch (e) {
    if ([401, 403].includes(e?.response?.status)) return null;
    return null;
  }
}

/* ---------------- АВТОРСКИЕ СТАТЬИ ---------------- */
export async function fetchAuthorArticles(params = {}) {
  const r = await api.get("/author/articles/", { params });
  return r.data;
}

export async function fetchNewsArticles(params = {}) {
  return fetchAuthorArticles(params);
}

// ---------------- ФЛАГ РЕЖИМА АДМИНА (BROWSER) ----------------
// Этот флаг хранится в localStorage и помечает браузер как "предпочитать Django-admin".

export function markAdminPreferred() {
  try {
    localStorage.setItem("admin_preferred", "1");
  } catch {}
}

export function isAdminPreferred() {
  try {
    return localStorage.getItem("admin_preferred") === "1";
  } catch {
    return false;
  }
}

export function setAdminPreferred(on = true) {
  try {
    if (on) localStorage.setItem("admin_preferred", "1");
    else localStorage.removeItem("admin_preferred");
  } catch {
    // ignore
  }
}


/* ---------------- АДМИН-СЕССИЯ ---------------- */
export async function adminEntrySession() {
  const r = await api.get("/security/admin-entry-session/", {
    headers: { Accept: "application/json" },
    validateStatus: (s) => s >= 200 && s < 400,
  });

  const data = r?.data;

  if (data && typeof data === "object") {
    const url =
      data.url ||
      data.admin_entry_url ||
      data.entry_url ||
      data.adminUrl ||
      data.admin_url ||
      null;

    if (url) return { ok: true, url };
  }

  const respUrl = r?.request?.responseURL || null;
  if (respUrl) return { ok: true, url: respUrl };

  // fallback URL для диагностики
  const base = (BACKEND_ORIGIN || API_BASE.replace(/\/api\/?$/, ""))
    .replace(/\/+$/, "");
  return { ok: false, url: `${base}/api/security/admin-entry-session/` };
}

export async function adminSessionLogin() {
  const r = await api.post("/security/admin-session-login/");
  return r.data;
}

export async function goToAdmin() {
  try {
    const r = await adminSessionLogin();

    // помечаем этот браузер как "режим админа"
    markAdminPreferred();

    const adminUrl = r?.admin_url || r?.url || null;
    const abs = toAbsoluteBackendUrl(adminUrl);
    if (abs) window.location.href = abs;
  } catch (err) {
    if (DEBUG_API) console.error("Не удалось открыть админку:", err);
  }
}


export default api;

/* ---------------- ГЛОБАЛЬНЫЙ ПАТЧ ДЛЯ window.fetch (браузер) ---------------- */
(function installGlobalFetchPatch() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;

  const orig = window.fetch;

  const hasToken = () => {
    try {
      return !!localStorage.getItem("access");
    } catch {
      return false;
    }
  };

  const abs = (u) => {
    try {
      return new URL(u, window.location.origin).toString();
    } catch {
      return String(u || "");
    }
  };

  function isEmptyRelated(u) {
    try {
      const x = new URL(u);
      const path = x.pathname.replace(/\/+$/, "/");
      return /\/api\/news\/related\/$/i.test(path) && !x.searchParams.has("slug");
    } catch {
      return false;
    }
  }

  function rewriteLegacy(u) {
    try {
      const x = new URL(u);
      const p = x.pathname.replace(/\/+$/, "/");
      const qs = x.searchParams;

      // /api/news/ -> /api/news/home-feed/
      if ((p === "/api/news/" || p === "/api/news") && !qs.has("category")) {
        x.pathname = "/api/news/home-feed/";
        return x.toString();
      }

      if (/\/api\/news\/check\/?$/i.test(p)) {
        const slug = qs.get("slug") || "";
        return slug
          ? `${API_BASE}/news/favorites/check/?slug=${encodeURIComponent(slug)}`
          : `${API_BASE}/news/favorites/check/`;
      }
      const mN = p.match(/\/api\/news\/check\/([^/]+)\/?$/i);
      if (mN)
        return `${API_BASE}/news/favorites/check/?slug=${encodeURIComponent(
          decodeURIComponent(mN[1])
        )}`;

      if (/\/api\/favorites\/check\/?$/i.test(p)) {
        const slug = qs.get("slug") || "";
        return slug
          ? `${API_BASE}/news/favorites/check/?slug=${encodeURIComponent(slug)}`
          : `${API_BASE}/news/favorites/check/`;
      }
      const mC = p.match(/\/api\/favorites\/check\/([^/]+)\/?$/i);
      if (mC)
        return `${API_BASE}/news/favorites/check/?slug=${encodeURIComponent(
          decodeURIComponent(mC[1])
        )}`;

      const mNC = p.match(/\/api\/news\/favorites\/check\/([^/]+)\/?$/i);
      if (mNC)
        return `${API_BASE}/news/favorites/check/?slug=${encodeURIComponent(
          decodeURIComponent(mNC[1])
        )}`;

      if (/\/api\/favorites\/toggle\/?$/i.test(p)) {
        const slug = qs.get("slug");
        return slug
          ? `${API_BASE}/news/favorites/toggle/?slug=${encodeURIComponent(slug)}`
          : `${API_BASE}/news/favorites/toggle/`;
      }
      const mT = p.match(/\/api\/favorites\/toggle\/([^/]+)\/?$/i);
      if (mT)
        return `${API_BASE}/news/favorites/toggle/?slug=${encodeURIComponent(
          decodeURIComponent(mT[1])
        )}`;
      const mNT = p.match(/\/api\/news\/favorites\/toggle\/([^/]+)\/?$/i);
      if (mNT)
        return `${API_BASE}/news/favorites/toggle/?slug=${encodeURIComponent(
          decodeURIComponent(mNT[1])
        )}`;

      if (/\/api\/news\/news\/$/i.test(p)) {
        const page = qs.get("page") || "1";
        const ps = qs.get("page_size") || qs.get("limit") || "20";
        return `${API_BASE}/news/category/news/?page=${encodeURIComponent(
          page
        )}&limit=${encodeURIComponent(ps)}&page_size=${encodeURIComponent(ps)}`;
      }

      return u;
    } catch {
      return u;
    }
  }

  window.fetch = async function patchedFetch(input, init = {}) {
    const url0 = abs(typeof input === "string" ? input : input?.url || "");

    if (isEmptyRelated(url0)) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json", "x-local": "1" },
      });
    }

    const url = rewriteLegacy(url0);

    if (!hasToken()) {
      if (/\/api\/news\/favorites\/check\/?/i.test(url)) {
        return new Response(JSON.stringify({ is_favorite: false }), {
          status: 200,
          headers: { "Content-Type": "application/json", "x-local": "1" },
        });
      }
      if (/\/api\/news\/favorites\/(toggle|)$/i.test(url)) {
        return new Response(JSON.stringify({ is_favorite: false }), {
          status: 200,
          headers: { "Content-Type": "application/json", "x-local": "1" },
        });
      }
    }

    if (url !== url0) return orig(url, init);
    return orig(input, init);
  };
})();

/* ---------------- ПАТЧ ДЛЯ <img> И СЫРОГО XHR (глушим /api/news/check/) ---------------- */
(function installLegacyCheckGuards() {
  if (typeof window === "undefined") return;

  function rewriteLegacy(u) {
    try {
      const x = new URL(String(u), window.location.origin);
      const p = x.pathname.replace(/\/+$/, "/");
      const qs = x.searchParams;

      if (/\/api\/news\/check\/?$/i.test(p)) {
        const slug = qs.get("slug") || "";
        return slug
          ? `${API_BASE}/news/favorites/check/?slug=${encodeURIComponent(slug)}`
          : `${API_BASE}/news/favorites/check/`;
      }
      const m = p.match(/\/api\/news\/check\/([^/]+)\/?$/i);
      if (m) {
        const slug = decodeURIComponent(m[1]);
        return `${API_BASE}/news/favorites/check/?slug=${encodeURIComponent(slug)}`;
      }
    } catch {}
    return String(u || "");
  }

  try {
    const desc = Object.getOwnPropertyDescriptor(Image.prototype, "src");
    if (desc && desc.set) {
      Object.defineProperty(Image.prototype, "src", {
        get: function () {
          return desc.get.call(this);
        },
        set: function (v) {
          desc.set.call(this, rewriteLegacy(v));
        },
        configurable: true,
        enumerable: true,
      });
    }
  } catch {}

  try {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      return origOpen.call(this, method, rewriteLegacy(url), ...rest);
    };
  } catch {}
})();

/* ---------------- ПОДПИСКА НА НОВОСТИ ---------------- */
export async function subscribeToNewsletter(email) {
  return api.post("/newsletter/subscribe/", { email });
}

/* ---------------- АВТОР: ПУБЛИЧНЫЙ ПРОФИЛЬ ---------------- */
export async function getAuthorPublic(authorIdOrSlug) {
  const key = String(authorIdOrSlug || "").trim();
  if (!key) throw new Error("getAuthorPublic: пустой id/slug");

  const paths = [
    `/accounts/public/${encodeURIComponent(key)}/`,
    `/accounts/author/${encodeURIComponent(key)}/`,
    `/accounts/profile/${encodeURIComponent(key)}/`,
    `/author/public/${encodeURIComponent(key)}/`,
    `/author/profile/${encodeURIComponent(key)}/`,
    `/authors/${encodeURIComponent(key)}/`,
    `/users/public/${encodeURIComponent(key)}/`,
    `/profiles/${encodeURIComponent(key)}/`,
  ];

  const r = await tryGet(paths);
  return r?.data || null;
}

export async function getAuthorPublicArticles(authorIdOrSlug, params = {}) {
  const key = String(authorIdOrSlug || "").trim();
  if (!key) throw new Error("getAuthorPublicArticles: пустой id/slug");

  const qs = params && typeof params === "object" ? params : {};

  const paths = [
    `/author/public/${encodeURIComponent(key)}/articles/`,
    `/authors/${encodeURIComponent(key)}/articles/`,
    `/accounts/public/${encodeURIComponent(key)}/articles/`,
    `/author/${encodeURIComponent(key)}/articles/`,
  ];

  const r = await tryGet(paths, { params: qs });
  return r?.data || [];
}

/* ---------------- КАНАЛ / НАСТРОЙКИ (ДЗЕН-СТИЛЬ) ---------------- */
export async function getChannelSettings() {
  const r = await tryGet([
    "/auth/settings/",
    "/accounts/settings/",
    "/accounts/channel/",
    "/users/settings/",
  ]);
  return r?.data || null;
}

export async function saveChannelSettings(payload = {}) {
  const body = payload && typeof payload === "object" ? payload : {};
  const r = await tryPost(
    ["/auth/settings/", "/accounts/settings/", "/accounts/channel/"],
    body
  );
  return r?.data || r;
}

export async function uploadChannelAvatar(file) {
  if (!file) throw new Error("uploadChannelAvatar: нужен file");

  const fd = new FormData();
  fd.append("photo", file);
  fd.append("avatar", file);
  fd.append("image", file);

  const r = await tryPost(
    [
      "/auth/settings/avatar/",
      "/accounts/settings/avatar/",
      "/accounts/channel/avatar/",
      "/auth/upload-avatar/",
    ],
    fd,
    { timeout: 120000 }
  );

  return r?.data || r;
}

export async function uploadChannelCover(file) {
  if (!file) throw new Error("uploadChannelCover: нужен file");

  const fd = new FormData();
  fd.append("cover", file);
  fd.append("cover_image", file);
  fd.append("image", file);

  const r = await tryPost(
    [
      "/auth/settings/cover/",
      "/accounts/settings/cover/",
      "/accounts/channel/cover/",
      "/auth/upload-cover/",
    ],
    fd,
    { timeout: 120000 }
  );

  return r?.data || r;
}
