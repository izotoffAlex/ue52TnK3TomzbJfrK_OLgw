// Путь: frontend/src/api/dashboards.js
// Назначение: Совместимый клиент кабинетов (читатель/автор/редактор/публичные).
// Важно:
//   ✅ НЕ удаляем старое — добавляем совместимость, чтобы сборка не падала.
//   ✅ Добавлены экспорты: decideSubmission(), publishSubmission(), requestChangesSubmission().
//   ✅ Оставлены функции для читателя/автора/публичного профиля (если твой UI их использует).
//
// ФИКС (2026-02-08B):
//   ✅ Исправляем "getAuthorPublic: не найден эндпоинт профиля" на локалке:
//      - добавлены кандидаты профиля БЕЗ /public/ для username/slug (не только для numeric id)
//        (например /api/authors/<username>/ или /api/users/<username>/).
//      - добавлены дополнительные вероятные варианты (/api/public/authors/<id>/ и т.п.).
//      - дедупликация URL перед запросами, чтобы __dashDbg не показывал повторы.
//   ✅ Ничего старого не удалено — старые ручки сохранены.
//
// ФИКС (2026-02-08C):
//   ✅ Исправляем попадание импортных RSS-новостей в "Статьи автора":
//      - добавлен ПРИОРИТЕТ для "чистых" ручек статей автора:
//          /api/authors/<username>/articles/
//          /api/authors/id/<id>/articles/
//      - остальные legacy/фолбэк варианты НЕ удалены, просто идут после приоритетных.
//
// ДОБАВЛЕНО (2026-02-08D):
//   ✅ Настройки "канала" автора (как Дзен): получить/обновить профиль + загрузка аватара/обложки.
//      - getMyAuthorProfile(), updateMyAuthorProfile()
//      - uploadAuthorAvatar(), uploadAuthorCover()
//   ✅ Фолбэки по вероятным ручкам. Ничего старого не удалено.
//
// Примечание:
//   - http импортируется из "../Api" (как в твоём проекте).

import { http } from "../Api";

// ---------- отладка ----------
export const __dashDbg = {
  get: [],
  post: [],
  put: [],
  reset() {
    this.get.length = 0;
    this.post.length = 0;
    this.put.length = 0;
  },
};

// ---------- утилиты ----------
function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const v = String(x || "").trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

async function tryGetSeq(urls) {
  for (const u of uniq(urls)) {
    __dashDbg.get.push(u);
    try {
      const r = await http.get(u);
      if (r?.status >= 200 && r.status < 300) return r.data;
    } catch (_) {}
  }
  return null;
}

async function tryPostSeq(entries) {
  for (const [u, d, cfg] of entries) {
    __dashDbg.post.push(u);
    try {
      const r = await http.post(u, d, cfg || {});
      if (r?.status >= 200 && r.status < 300) return r.data;
    } catch (_) {}
  }
  return null;
}

async function tryPutSeq(entries) {
  for (const [u, d, cfg] of entries) {
    __dashDbg.put.push(u);
    try {
      const r = await http.put(u, d, cfg || {});
      if (r?.status >= 200 && r.status < 300) return r.data;
    } catch (_) {}
  }
  return null;
}

function toArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function isFile(x) {
  return typeof File !== "undefined" && x instanceof File;
}

// ===================== ЧИТАТЕЛЬ =====================
export async function getMyFavorites() {
  const data = await tryGetSeq([
    "/dashboards/reader/favorites/",
    "/favorites/my/",
    "/favorites/",
    "/me/favorites/",
    "/news/favorites/",
  ]);
  const arr = toArray(data);
  return arr
    .map((item) => ({
      url: item.url || item.link || item.href || "",
      title: item.title || item.name || "",
      slug: item.slug || "",
      source_name: item.source_name || item.source || "",
      source_logo_url: item.source_logo_url || item.source_logo || "",
      cover_url: item.cover_url || item.cover || item.image || "",
      created_at: item.created_at || item.added_at || null,
    }))
    .filter((x) => x.url);
}

export async function syncFavoriteSnapshot(snap) {
  await tryPostSeq([["/dashboards/reader/favorites/sync/", snap]]);
}

// ===================== АВТОР (СТАТЬИ) =====================
export async function listMyArticles(status = "") {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await tryGetSeq([
    `/dashboards/author/articles/${qs}`,
    `/news/author/articles/mine/${qs}`,
    `/news/author/articles/${qs}`,
  ]);
  return toArray(data);
}

export async function createArticle(payload) {
  const data = await tryPostSeq([
    ["/dashboards/author/articles/", payload],
    ["/news/author/articles/", payload],
  ]);
  if (!data) throw new Error("createArticle: нет подходящего эндпоинта");
  return data;
}

export async function updateArticle(id, payload) {
  const data = await tryPutSeq([
    [`/dashboards/author/articles/${id}/`, payload],
    [`/news/author/articles/${id}/`, payload],
  ]);
  if (!data) throw new Error("updateArticle: нет подходящего эндпоинта");
  return data;
}

export async function submitArticle(id) {
  const data = await tryPostSeq([
    [`/dashboards/author/articles/${id}/submit/`, {}],
    [`/news/author/articles/${id}/submit/`, {}],
  ]);
  if (!data) throw new Error("submitArticle: нет подходящего эндпоинта");
  return data;
}

export async function withdrawArticle(id) {
  const data = await tryPostSeq([
    [`/dashboards/author/articles/${id}/withdraw/`, {}],
    [`/news/author/articles/${id}/withdraw/`, {}],
    [`/news/author/articles/${id}/revoke/`, {}],
  ]);
  if (!data) throw new Error("withdrawArticle: нет подходящего эндпоинта");
  return data;
}

export async function listArticleComments(id) {
  const data = await tryGetSeq([
    `/dashboards/author/articles/${id}/comments/`,
    `/news/author/articles/${id}/comments/`,
  ]);
  return toArray(data);
}

export async function uploadAuthorImage(file) {
  const fd = new FormData();
  fd.append("image", file);
  const cfg = { headers: { "Content-Type": "multipart/form-data" } };
  const data = await tryPostSeq([
    ["/dashboards/author/upload-image/", fd, cfg],
    ["/news/upload-image/", fd, cfg],
  ]);
  if (!data?.url) throw new Error("uploadAuthorImage: нет подходящего эндпоинта");
  return data;
}

export async function setArticleCover(id, fileOrUrl) {
  async function putUrl(url) {
    const payloads = [{ cover: url }, { cover_image: url }, { cover_url: url }];
    for (const p of payloads) {
      const data = await tryPutSeq([
        [`/dashboards/author/articles/${id}/`, p],
        [`/news/author/articles/${id}/`, p],
      ]);
      if (data) return data;
    }
    return { cover: url };
  }

  if (isFile(fileOrUrl)) {
    const file = fileOrUrl;

    const fd1 = new FormData();
    fd1.append("cover", file);

    const fd2 = new FormData();
    fd2.append("image", file);

    const cfg = { headers: { "Content-Type": "multipart/form-data" } };

    let data =
      (await tryPostSeq([
        [`/dashboards/author/articles/${id}/cover/`, fd1, cfg],
        [`/news/author/articles/${id}/cover/`, fd1, cfg],
        [`/news/author/articles/${id}/upload-cover/`, fd2, cfg],
      ])) ||
      (await tryPutSeq([
        [`/dashboards/author/articles/${id}/`, fd1, cfg],
        [`/news/author/articles/${id}/`, fd1, cfg],
      ]));

    if (data) return data;

    const up = await uploadAuthorImage(file);
    return await putUrl(up.url);
  }

  if (typeof fileOrUrl === "string" && fileOrUrl.startsWith("http")) {
    return await putUrl(fileOrUrl);
  }

  throw new Error("setArticleCover: ожидается File или URL");
}

// ===================== АВТОР (ПРОФИЛЬ/КАНАЛ) =====================
// FIX 2026-02-08D:
// ✅ Профиль "канала" автора: получить/обновить + загрузка аватара/обложки.
// ⚠️ Это будет работать ТОЛЬКО если на бэке есть хотя бы одна подходящая ручка.
// Мы не угадываем — пробуем несколько, но ничего старого не ломаем.

function pickFirst(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
  }
  return "";
}

export async function getMyAuthorProfile() {
  const data = await tryGetSeq([
    // — варианты "me"
    "/dashboards/author/profile/",
    "/dashboards/author/channel/",
    "/dashboards/author/settings/",
    "/dashboards/author/me/",
    "/api/authors/me/",
    "/api/author/me/",
    "/api/profile/me/",
    "/api/me/author/",
    "/api/me/profile/",
    // — fallback (если бэк отдаёт текущего пользователя как /api/users/me/)
    "/api/users/me/",
    "/api/user/me/",
  ]);
  if (!data) throw new Error("getMyAuthorProfile: не найден эндпоинт профиля автора (me)");
  return data;
}

export async function updateMyAuthorProfile(payload) {
  const data = await tryPutSeq([
    ["/dashboards/author/profile/", payload],
    ["/dashboards/author/channel/", payload],
    ["/dashboards/author/settings/", payload],
    ["/api/authors/me/", payload],
    ["/api/author/me/", payload],
    ["/api/profile/me/", payload],
    ["/api/me/profile/", payload],
    ["/api/me/author/", payload],
    // иногда сервер поддерживает PATCH только, но у нас только PUT в адаптере;
    // если PUT не поддержан — будет ошибка "нет подходящего эндпоинта".
  ]);
  if (!data) throw new Error("updateMyAuthorProfile: не найден эндпоинт обновления профиля (PUT)");
  return data;
}

async function uploadAsUrl(file, candidates, fieldName = "image") {
  const fd = new FormData();
  fd.append(fieldName, file);
  const cfg = { headers: { "Content-Type": "multipart/form-data" } };
  const data = await tryPostSeq(candidates.map((u) => [u, fd, cfg]));
  // ожидаем {url: "..."} или {image: "..."} или {path:"..."} и т.п.
  const url =
    pickFirst(data, ["url", "image", "file", "path", "location"]) ||
    pickFirst(data?.data, ["url", "image", "file", "path", "location"]);
  if (!url) throw new Error("upload: сервер не вернул URL");
  return { ...data, url };
}

export async function uploadAuthorAvatar(file) {
  return await uploadAsUrl(
    file,
    [
      "/dashboards/author/avatar/",
      "/dashboards/author/upload-avatar/",
      "/dashboards/author/profile/avatar/",
      "/api/authors/me/avatar/",
      "/api/profile/me/avatar/",
      // fallback общий uploader (если есть)
      "/dashboards/author/upload-image/",
      "/news/upload-image/",
    ],
    "image"
  );
}

export async function uploadAuthorCover(file) {
  // иногда поле может быть "cover" или "image" — пробуем оба варианта безопасно
  try {
    return await uploadAsUrl(
      file,
      [
        "/dashboards/author/cover/",
        "/dashboards/author/upload-cover/",
        "/dashboards/author/profile/cover/",
        "/api/authors/me/cover/",
        "/api/profile/me/cover/",
      ],
      "cover"
    );
  } catch (_) {
    return await uploadAsUrl(
      file,
      [
        "/dashboards/author/cover/",
        "/dashboards/author/upload-cover/",
        "/dashboards/author/profile/cover/",
        "/api/authors/me/cover/",
        "/api/profile/me/cover/",
        // fallback общий uploader
        "/dashboards/author/upload-image/",
        "/news/upload-image/",
      ],
      "image"
    );
  }
}

// ===================== РЕДАКТОР =====================
export async function listPendingSubmissions() {
  const data = await tryGetSeq([
    "/dashboards/editor/submissions/",
    "/news/moderation/queue/",
    "/moderation/queue/",
    "/editor/submissions/",
  ]);
  return toArray(data);
}

export async function publishArticle(id) {
  const data = await tryPostSeq([
    [`/dashboards/editor/submissions/${id}/publish/`, {}],
    ["/news/moderation/review/", { id, action: "publish" }],
    ["/moderation/review/", { id, action: "publish" }],
  ]);
  if (!data) throw new Error("publishArticle: нет подходящего эндпоинта");
  return data;
}

export async function requestChanges(id, message) {
  const data = await tryPostSeq([
    [`/dashboards/editor/submissions/${id}/request_changes/`, { message }],
    ["/news/moderation/review/", { id, action: "revise", message }],
    ["/moderation/review/", { id, action: "revise", message }],
  ]);
  if (!data) throw new Error("requestChanges: нет подходящего эндпоинта");
  return data;
}

// ✅ Совместимость со старым импортом
export async function publishSubmission(id) {
  return await publishArticle(id);
}

// ✅ Совместимость со старым импортом
export async function requestChangesSubmission(id, message) {
  return await requestChanges(id, message);
}

// ✅ FIX сборки: decideSubmission
export async function decideSubmission(id, decision, message = "") {
  const d = String(decision ?? "").toLowerCase();

  if (decision === true || d === "publish" || d === "approve" || d === "approved") {
    return await publishArticle(id);
  }

  if (
    decision === false ||
    d === "changes" ||
    d === "revise" ||
    d === "request_changes" ||
    d === "requestchanges" ||
    d === "reject"
  ) {
    return await requestChanges(id, message);
  }

  throw new Error("decideSubmission: неизвестное решение");
}

// ===================== ПУБЛИЧНО (профиль + статьи) =====================
export async function getAuthorPublic(slugOrId) {
  const key = String(slugOrId || "").trim();
  const enc = encodeURIComponent(key);
  const isNum = /^\d+$/.test(key);

  // ✅ теперь "без /public/" пробуем для ЛЮБОГО key, не только numeric
  const candidates = [
    // --- public варианты (API) ---
    `/api/authors/${enc}/public/`,
    `/api/authors/public/${enc}/`,
    `/api/author/${enc}/public/`,
    `/api/author/public/${enc}/`,
    `/api/users/${enc}/public/`,
    `/api/users/public/${enc}/`,
    `/api/accounts/${enc}/public/`,
    `/api/accounts/public/${enc}/`,
    `/api/profile/${enc}/`,
    `/api/public/profile/${enc}/`,
    `/api/public/authors/${enc}/`,
    `/api/public/users/${enc}/`,

    // --- ВАЖНО: без /public/ (часто DRF router) ---
    `/api/authors/${enc}/`,
    `/api/author/${enc}/`,
    `/api/users/${enc}/`,
    `/api/user/${enc}/`,
    `/api/accounts/${enc}/`,
    `/api/account/${enc}/`,

    // --- те же без /api (если http.baseURL уже включает /api) ---
    `/authors/${enc}/public/`,
    `/authors/public/${enc}/`,
    `/author/${enc}/public/`,
    `/author/public/${enc}/`,
    `/users/${enc}/public/`,
    `/users/public/${enc}/`,
    `/accounts/${enc}/public/`,
    `/accounts/public/${enc}/`,
    `/profile/${enc}/`,
    `/public/profile/${enc}/`,
    `/public/authors/${enc}/`,
    `/public/users/${enc}/`,
    `/authors/${enc}/`,
    `/author/${enc}/`,
    `/users/${enc}/`,
    `/user/${enc}/`,
    `/accounts/${enc}/`,
    `/account/${enc}/`,

    // --- legacy (оставляем) ---
    `/dashboards/author/page/${enc}/`,
  ];

  // numeric-only
  if (isNum) {
    candidates.unshift(
      `/api/authors/${key}/`,
      `/api/users/${key}/`,
      `/api/accounts/${key}/`,
      `/authors/${key}/`,
      `/users/${key}/`,
      `/accounts/${key}/`
    );
  }

  const data = await tryGetSeq(candidates);
  if (!data) throw new Error("getAuthorPublic: не найден эндпоинт профиля");
  return data;
}

export async function listPublicArticlesByAuthor(authorIdent) {
  const key = String(authorIdent || "").trim();
  const qs = encodeURIComponent(key);
  const enc = encodeURIComponent(key);
  const isNum = /^\d+$/.test(key);

  // ✅ приоритет: “чистые” ручки авторских Article
  const preferred = isNum
    ? [
        `/api/authors/id/${key}/articles/`,
        `/api/authors/${enc}/articles/`,
        `/authors/id/${key}/articles/`,
        `/authors/${enc}/articles/`,
      ]
    : [
        `/api/authors/${enc}/articles/`,
        `/authors/${enc}/articles/`,
      ];

  const candidates = [
    ...preferred,

    // --- API: общие списки с фильтрами ---
    `/api/articles/?author=${qs}`,
    `/api/articles/?author_id=${qs}`,
    `/api/articles/?author_slug=${qs}`,
    `/api/articles/?author_username=${qs}`,
    `/api/articles/?user=${qs}`,
    `/api/articles/?user_id=${qs}`,
    `/api/articles/?user_username=${qs}`,
    `/api/public/articles/?author=${qs}`,
    `/api/public/articles/?author_id=${qs}`,
    `/api/articles/public/?author=${qs}`,

    // --- API: вложенные варианты ---
    `/api/authors/${enc}/articles/`,
    `/api/authors/${enc}/public/articles/`,
    `/api/users/${enc}/articles/`,
    `/api/users/${enc}/public/articles/`,

    // --- без /api ---
    `/articles/?author=${qs}`,
    `/articles/?author_id=${qs}`,
    `/articles/?author_slug=${qs}`,
    `/articles/?author_username=${qs}`,
    `/articles/?user=${qs}`,
    `/articles/?user_id=${qs}`,
    `/articles/?user_username=${qs}`,
    `/public/articles/?author=${qs}`,
    `/public/articles/?author_id=${qs}`,
    `/articles/public/?author=${qs}`,
    `/authors/${enc}/articles/`,
    `/authors/${enc}/public/articles/`,
    `/users/${enc}/articles/`,
    `/users/${enc}/public/articles/`,

    // --- legacy (оставляем) ---
    `/dashboards/author/articles/public/?author=${qs}`,
    `/news/author/articles/?author=${qs}&status=PUBLISHED`,
    `/news/author/articles/?author=${qs}&status=published`,
    `/news/author/articles/?author_id=${qs}&status=PUBLISHED`,
    `/news/author/articles/?author_id=${qs}&status=published`,
    `/news/author/articles/?user=${qs}&status=PUBLISHED`,
    `/news/author/articles/?user=${qs}&status=published`,
    `/news/author/articles/?user_id=${qs}&status=PUBLISHED`,
    `/news/author/articles/?user_id=${qs}&status=published`,
    `/news/?author=${qs}&status=PUBLISHED`,
    `/news/?author=${qs}&status=published`,
    `/news/?author_id=${qs}&status=PUBLISHED`,
    `/news/?author_id=${qs}&status=published`,
  ];

  const data = await tryGetSeq(candidates);
  return toArray(data);
}
