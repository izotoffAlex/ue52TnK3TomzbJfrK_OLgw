// Путь: frontend/src/Api.js
// Назначение: Axios-инстанс и функции API (новости, категории, поиск, SEO-маршруты, аутентификация).
// Исправления в этой версии:
//   ✅ fetchCategoryNews: одна "основная" попытка на /category/<slug>/; 404 "Invalid page" -> заканчиваем пагинацию без лишних 404
//   ✅ fetchCategoryNews: запасные пути дергаются ТОЛЬКО если основной путь реально не существует
//   ✅ fetchRelated: 404 теперь не шумит в консоли, просто возвращает []
//   ✅ ДОБАВЛЕНО: fetchRelatedByCategory(categorySlug, excludeSlug?, page?) — для блока «Похожие»
//   ✅ ДОБАВЛЕНО: normalize-обёртка для resolveNews(slug) — возвращает { item, category, categoryName, seo_url, slug }
//   ✅ ЭКСПОРТЫ: tryGet и attachSeoUrl теперь экспортируются (совместимость со старым кодом)
//   ✅ fetchArticle: больше НЕ бросает исключение при пустом slug — возвращает null (чтобы не спамить консоль)
//   ✅ Остальной код без изменений

import axios from "axios";

// ---------------- БАЗОВАЯ НАСТРОЙКА ----------------
const api = axios.create({
  baseURL: "http://localhost:8000/api",
});

// ---------------- JWT УТИЛИТЫ ----------------
function parseJwt(token) {
  try {
    const [, payload] = token.split(".");
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

function isJwtValid(token) {
  const p = parseJwt(token);
  if (!p || !p.exp) return false;
  return p.exp > Date.now() / 1000 + 5;
}

function dropToken() {
  try {
    localStorage.removeItem("access");
  } catch {}
  delete api.defaults.headers.common["Authorization"];
}

function applyAuthHeader(token) {
  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

// ---------------- ОБЩИЕ УТИЛИТЫ ----------------
function normalizeSlug(raw) {
  if (!raw) return raw;
  let v = String(raw).trim();
  try {
    v = decodeURIComponent(v);
  } catch {}
  v = v.replace(/[?#].*$/g, "").replace(/-{2,}/g, "-").replace(/[-/]+$/g, "");
  return v.trim();
}

function slugCandidates(raw) {
  if (!raw) return [];
  const t = String(raw).trim().replace(/[-/]+$/g, "");
  const norm = normalizeSlug(t);
  return Array.from(new Set([norm, t])).filter(Boolean);
}

/**
 * tryGet(paths, config)
 * - paths: string | string[]
 * - config: axios config (optional)
 * Возвращает response (axios response) или бросает последний пойманный error.
 */
export async function tryGet(paths, config = {}) {
  const list = typeof paths === "string" ? [paths] : Array.isArray(paths) ? paths : [];
  let lastErr = null;
  for (const p of list) {
    try {
      const r = await api.get(p, config);
      return r;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
  throw new Error("Все варианты путей вернули ошибку");
}

/**
 * attachSeoUrl(obj, type)
 * - корректно формирует seo_url если его нет:
 *   /<category-slug>/<slug>  (или /news/<slug> как fallback)
 */
export function attachSeoUrl(obj = {}, type = "") {
  try {
    if (!obj || obj.seo_url) return obj;
    const cat =
      (obj.category && obj.category.slug) ||
      (Array.isArray(obj.categories) && obj.categories[0] && obj.categories[0].slug) ||
      obj.category_slug ||
      null;

    const base = cat ? `/${cat}` : "/news";
    if (obj.slug) obj.seo_url = `${base}/${obj.slug}`;
    else if (obj.title)
      obj.seo_url = `${base}/${encodeURIComponent(String(obj.title).toLowerCase().replace(/\s+/g, "-"))}`;
  } catch {}
  return obj;
}

// ---------------- JWT ----------------
export function setToken(token) {
  if (token && isJwtValid(token)) {
    try {
      localStorage.setItem("access", token);
    } catch {}
    applyAuthHeader(token);
  } else dropToken();
}

let saved = null;
try {
  saved = localStorage.getItem("access");
} catch {}
if (saved && isJwtValid(saved)) applyAuthHeader(saved);
else dropToken();

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const status = err?.response?.status;
    const config = err?.config || {};
    if (status === 401) {
      dropToken();
      if (!config._retry) {
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
    }
    return Promise.reject(err);
  }
);

// ---------------- ЛЕНТА ----------------
export async function fetchNews(page = 1) {
  try {
    const r = await api.get("/news/feed/", { params: { page } });
    let data = [];

    if (Array.isArray(r.data)) data = r.data;
    else if (Array.isArray(r.data.results)) data = r.data.results;
    else if (r.data.results && typeof r.data.results === "object")
      data = Object.values(r.data.results);
    else if (Array.isArray(r.data.items)) data = r.data.items;
    else if (r.data?.results?.results) data = r.data.results.results;

    if (!Array.isArray(data)) {
      console.warn("⚠️ fetchNews: неожиданный формат ответа:", r.data);
      data = [];
    }
    return data.map((n) => attachSeoUrl(n));
  } catch (err) {
    console.error("Ошибка загрузки новостей:", err);
    return [];
  }
}

// ---------------- КАТЕГОРИИ ----------------
export async function fetchCategories() {
  try {
    const r = await api.get("/categories/");
    const data = r.data;

    if (Array.isArray(data)) return data;
    if (Array.isArray(data.results)) return data.results;
    if (data && typeof data === "object" && data.results) {
      return Array.isArray(data.results) ? data.results : Object.values(data.results);
    }

    console.warn("⚠️ fetchCategories: неожиданный формат ответа", data);
    return [];
  } catch (err) {
    console.error("Ошибка загрузки категорий:", err);
    return [];
  }
}

// ---------------- КАТЕГОРИЯ - НОВОСТИ ----------------
/**
 * Важно: DRF для page вне диапазона возвращает 404 ("Invalid page.") — это НЕ ошибка API.
 * Здесь мы трактуем такой 404 как «больше страниц нет», возвращаем [] и НЕ пробуем запасные пути.
 * Запасные пути дергаем только если основной эндпоинт отсутствует (реальный 404 Not found).
 */
export async function fetchCategoryNews(slug, page = 1) {
  if (!slug) return [];
  const encoded = encodeURIComponent(slug);

  // Основной и корректный путь согласно backend/news/urls.py
  const primaryPath = `/category/${encoded}/`;

  // Парсер форматов ответа
  const pickItems = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    if (data?.results?.results) return data.results.results;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.results?.items)) return data.results.items;
    return [];
  };

  // 1) Пробуем основной эндпоинт. Если 404 с "Invalid page" — выходим без фолбэков.
  try {
    const r = await api.get(primaryPath, { params: { page } });
    return pickItems(r.data).map(attachSeoUrl);
  } catch (err) {
    const status = err?.response?.status;
    const detail =
      err?.response?.data?.detail ||
      err?.response?.data?.error ||
      (typeof err?.response?.data === "string" ? err.response.data : "");

    const isInvalidPage =
      status === 404 && /invalid\s*page|page\s*(number)?\s*out/i.test(String(detail));

    if (isInvalidPage) {
      // Конец пагинации — тихо возвращаем []
      return [];
    }

    // 2) Если это просто «Not found» (эндпоинт другой) — пробуем запасные пути.
    if (status === 404) {
      const fallbacks = [`/news/category/${encoded}/`, `/news/${encoded}/`];
      for (const p of fallbacks) {
        try {
          const r2 = await api.get(p, { params: { page } });
          return pickItems(r2.data).map(attachSeoUrl);
        } catch (e2) {
          const st2 = e2?.response?.status;
          const det2 =
            e2?.response?.data?.detail ||
            e2?.response?.data?.error ||
            (typeof e2?.response?.data === "string" ? e2.response.data : "");
          const isInvalid2 =
            st2 === 404 && /invalid\s*page|page\s*(number)?\s*out/i.test(String(det2));
          if (isInvalid2) return [];
          // иначе продолжаем к следующему фолбэку
        }
      }
      // Все фолбэки дали 404 — вернём []
      return [];
    }

    // Любая другая ошибка — пишем в лог один раз и возвращаем []
    console.error("Ошибка загрузки новостей категории:", err);
    return [];
  }
}

// ---------------- ПОИСК ----------------
export async function searchAll(query, { limit = 30, offset = 0 } = {}) {
  if (!query) return { items: [], total: 0 };
  try {
    const r = await api.get("/news/search/", { params: { q: query, limit, offset } });
    const items = r.data.results || r.data.items || [];
    return { items: items.map((n) => attachSeoUrl(n)), total: r.data.count ?? items.length };
  } catch (e) {
    console.error("Ошибка поиска:", e);
    return { items: [], total: 0 };
  }
}

export async function fetchSmartSearch(query) {
  if (!query || query.length < 2) return [];
  try {
    const r = await api.get("/news/search/smart/", { params: { q: query }, timeout: 5000 });
    const results = Array.isArray(r.data?.results) ? r.data.results : Array.isArray(r.data) ? r.data : [];
    return results.map((n) => attachSeoUrl(n));
  } catch {
    return [];
  }
}

// ---------------- СТАТЬИ ----------------
export async function fetchArticle(category, slug) {
  // ⚠️ Раньше здесь бросалось исключение при пустом slug — убрал, возвращаем null
  if (!slug) return null;

  const cat = category || "news"; // fallback
  const cands = slugCandidates(slug);

  const paths = [
    ...cands.flatMap((s) => [
      `/news/article/${encodeURIComponent(cat)}/${encodeURIComponent(s)}/`,
      `/news/${encodeURIComponent(cat)}/${encodeURIComponent(s)}/`,
      `/news/${encodeURIComponent(s)}/`,
      `/article/${encodeURIComponent(s)}/`,
    ]),
  ];

  try {
    const r = await tryGet(paths);
    return attachSeoUrl(r.data, "article");
  } catch (err) {
    console.error("Ошибка загрузки статьи:", err);
    return null; // мягко
  }
}

export async function fetchImportedNews(source, slug) {
  if (!source || !slug) throw new Error("fetchImportedNews: нужен source и slug");
  const cands = slugCandidates(slug);
  const paths = cands.map((s) => `/news/rss/${encodeURIComponent(source)}/${encodeURIComponent(s)}/`);
  try {
    const r = await tryGet(paths);
    return attachSeoUrl(r.data, "rss");
  } catch (err) {
    console.error("Ошибка загрузки импортированной новости:", err);
    throw err;
  }
}

// ---------------- ПОХОЖИЕ НОВОСТИ ----------------
export async function fetchRelated(type, param, slug) {
  if (!param || !slug) return []; // безопасный fallback

  const cands = slugCandidates(slug);

  const rssPaths = cands.map((s) => `/news/rss/${encodeURIComponent(param)}/${encodeURIComponent(s)}/related/`);
  const articlePaths = cands.map((s) => `/news/article/${encodeURIComponent(param)}/${encodeURIComponent(s)}/related/`);
  const universalPaths = cands.map((s) => `/news/${encodeURIComponent(param)}/${encodeURIComponent(s)}/related/`);

  const paths = [...rssPaths, ...articlePaths, ...universalPaths];

  try {
    const r = await tryGet(paths);
    const data = r.data?.results || r.data || [];
    return Array.isArray(data) ? data.map((n) => attachSeoUrl(n)) : [];
  } catch (err) {
    const st = err?.response?.status;
    if (st === 404) return []; // тихо
    console.warn("Ошибка fetchRelated (подавлена):", err?.message || err);
    return [];
  }
}

// НОВЫЙ корректный способ для блока «Похожие»: берём страницу категории
export async function fetchRelatedByCategory(categorySlug, excludeSlug = null, page = 1) {
  if (!categorySlug) return [];
  try {
    const r = await api.get(`/category/${encodeURIComponent(categorySlug)}/`, {
      params: { page },
    });
    const list = Array.isArray(r.data?.results)
      ? r.data.results
      : Array.isArray(r.data)
      ? r.data
      : [];
    const arr = excludeSlug
      ? list.filter((n) => (n.slug || n.id) !== excludeSlug)
      : list;
    return arr.map((n) => attachSeoUrl(n));
  } catch {
    return [];
  }
}

// ---------------- МЕТРИКИ ----------------
export async function hitMetrics(type, slug) {
  try {
    const normType = type === "a" ? "article" : type === "i" ? "rss" : type;
    const cands = slugCandidates(slug);
    const s = cands[0] || normalizeSlug(slug);
    const r = await api.post("/news/metrics/hit/", { type: normType, slug: s });
    return r.data;
  } catch (e) {
    console.error("metrics/hit error", e);
    return null;
  }
}

// ---------------- РЕЗОЛВЕР ----------------
export async function resolveNews(slug) {
  if (!slug) return null;
  const norm = normalizeSlug(slug);
  const paths = [
    `/news/resolve/${encodeURIComponent(norm)}/`,
    `/news/by-slug/${encodeURIComponent(norm)}/`,
  ];
  try {
    const r = await tryGet(paths);
    const data = r.data;

    // Нормализация ответа под NewsDetailPage
    const item =
      data?.item ||
      data?.article ||
      data?.imported ||
      (data?.result && (data.result.article || data.result.imported)) ||
      data?.data ||
      data;

    const category =
      item?.category ||
      data?.category ||
      (typeof data?.category_slug === "string"
        ? {
            slug: data.category_slug,
            name:
              data.category_name ||
              data.category_ru ||
              data.category ||
              data.category_slug,
          }
        : null);

    const canonicalSlug =
      item?.slug ||
      data?.slug ||
      data?.canonical_slug ||
      (typeof data?.seo_url === "string"
        ? data.seo_url.split("/").filter(Boolean).pop()
        : norm);

    const image =
      item?.image ||
      item?.image_url ||
      item?.cover_image ||
      item?.preview_image ||
      item?.thumbnail ||
      null;

    return {
      item: { ...item, slug: canonicalSlug, image },
      category: category
        ? { slug: category.slug || category, name: category.name || category.slug }
        : null,
      categoryName: category?.name || category?.slug || null,
      seo_url: item?.seo_url || data?.seo_url || null,
      slug: canonicalSlug,
    };
  } catch (err) {
    console.error("resolveNews error", err);
    return null;
  }
}

// ---------------- СТРАНИЦЫ ----------------
export async function fetchPages() {
  try {
    const r = await api.get("/pages/");
    return r.data;
  } catch (err) {
    console.error("fetchPages error", err);
    return [];
  }
}
export async function fetchPage(slug) {
  try {
    const r = await api.get(`/pages/${slug}/`);
    return r.data;
  } catch (err) {
    console.error("fetchPage error", err);
    return null;
  }
}

// ---------------- ПРЕДЛОЖИТЬ НОВОСТЬ ----------------
export async function suggestNews(payload) {
  try {
    const r = await api.post("/news/suggest/", payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });
    return r.data;
  } catch (e) {
    if (e.response?.data) throw e.response.data;
    throw new Error(e.message || "Network error");
  }
}

// ---------------- АУТЕНТИФИКАЦИЯ ----------------
export async function login(username, password) {
  const r = await api.post("/auth/login/", { username, password });
  const token = r.data?.access;
  if (token) setToken(token);
  return r.data;
}
export async function register(data) {
  const r = await api.post("/auth/register/", data);
  return r.data;
}
export async function whoami() {
  try {
    const token = localStorage.getItem("access");
    if (!token || !isJwtValid(token)) return null;
    const r = await api.get("/auth/me/");
    return r.data;
  } catch {
    return null;
  }
}

// ---------------- АДМИН-СЕССИЯ ----------------
export async function adminSessionLogin() {
  const r = await api.post("/security/admin-session-login/");
  return r.data;
}
export async function goToAdmin() {
  try {
    const r = await adminSessionLogin();
    let url = r.admin_url;
    if (url.startsWith("/")) {
      const base = api.defaults.baseURL.replace(/\/api$/, "");
      url = base + url;
    }
    window.location.href = url;
  } catch (err) {
    console.error("Не удалось открыть админку:", err);
  }
}

export default api;
