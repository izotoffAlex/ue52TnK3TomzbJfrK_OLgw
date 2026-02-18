/* Путь: frontend/src/api/authorArticles.js
   Назначение: API-утилиты автора: создать черновик, обновить, опубликовать.
   Особенности:
   - Использует уже существующий axios-инстанс http из ./Api.
   - tryPost/tryPut/tryPostNoBody пробуют несколько совместимых маршрутов,
     чтобы не ловить 404 от разных версий бэкенда.
*/

import { http } from "../Api";

// Кандидаты на маршруты (совместимость)
const CREATE_ROUTES = [
  "/news/author/articles/",
  "/dashboards/author/articles/",
];
const UPDATE_ROUTES = (id) => [
  `/news/author/articles/${id}/`,
  `/dashboards/author/articles/${id}/`,
];
const PUBLISH_ROUTES = (id) => [
  `/news/author/articles/${id}/publish/`,
  `/dashboards/author/articles/${id}/publish/`,
];

// Вспомогалки
async function tryPost(paths, payload) {
  let lastErr;
  for (const p of paths) {
    try {
      const { data } = await http.post(p, payload);
      return data;
    } catch (e) {
      lastErr = e;
      if (!e?.response || ![400,401,403,404,405].includes(e.response.status)) throw e;
    }
  }
  throw lastErr;
}
async function tryPut(paths, payload) {
  let lastErr;
  for (const p of paths) {
    try {
      const { data } = await http.put(p, payload);
      return data;
    } catch (e) {
      lastErr = e;
      if (!e?.response || ![400,401,403,404,405].includes(e.response.status)) throw e;
    }
  }
  throw lastErr;
}
async function tryPostNoBody(paths) {
  let lastErr;
  for (const p of paths) {
    try {
      const { data } = await http.post(p);
      return data;
    } catch (e) {
      lastErr = e;
      if (!e?.response || ![400,401,403,404,405].includes(e.response.status)) throw e;
    }
  }
  throw lastErr;
}

// Публичные функции
export async function createDraft({ title, body_json }) {
  const payload = { title, body_json };
  return await tryPost(CREATE_ROUTES, payload);
}

export async function updateDraft(id, { title, body_json }) {
  const payload = { title, body_json };
  return await tryPut(UPDATE_ROUTES(id), payload);
}

export async function publishArticle(id) {
  return await tryPostNoBody(PUBLISH_ROUTES(id));
}

/** Гарантирует, что у нас есть article.id: если нет — создаёт. */
export async function ensureArticleId(currentId, { title, body_json }) {
  if (currentId) return currentId;
  const created = await createDraft({ title, body_json });
  const newId = created?.id || created?.pk || created?.article?.id;
  if (!newId) {
    throw new Error("Бэкенд не вернул ID статьи после создания черновика.");
  }
  return newId;
}
