// Путь: frontend/src/api/favoritesV2.js
// Назначение: Обёртка для устойчивых ручек избранного (V2) без обращений к устаревшим путям.
// Содержимое (полный файл):
//   - FRONTEND_LOGIN_URL — адрес логина (если нужно редиректить гостей)
//   - normalizeFavoriteCheckResponse / normalizeFavoriteToggleResponse — унификация ответов бэка
//   - getWith401 / postWith401 — помощники с ловлей 401 (ставят флаг __unauth)
//   - favoritesCheckV2(slug) — проверка «в избранном?» с каскадом маршрутов (без /news/check/)
//   - favoritesToggleV2(slug) — переключатель избранного с каскадом маршрутов (без /news/toggle/)
//   - __FAV_V2_BUILD_ID — метка версии для отладки в консоли (в dev-режиме)
//
// ВАЖНО: здесь НЕТ обращений к /news/check/ и /news/toggle/,
//        только современные пути: /favorites/check[/<slug>/] и /news/favorites/* как бэкап.

import { http } from "../Api";

// Логин-страница фронтенда (для редиректа гостей при 401)
export const FRONTEND_LOGIN_URL = (process.env.REACT_APP_FRONTEND_LOGIN_URL || "/login").replace(/\/?$/, "");

// Уникальная метка для отладки — увидишь её в консоли один раз при загрузке модуля
export const __FAV_V2_BUILD_ID = "favoritesV2@api-v2.1-2025-10-29";
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.debug(`[favorites] loaded ${__FAV_V2_BUILD_ID}`);
}

// --- Вспомогательные утилиты нормализации ---
function normalizeFavoriteCheckResponse(data) {
  if (!data || typeof data !== "object") return { exists: false };
  const exists =
    Boolean(data.exists) ||
    Boolean(data.favorite) ||
    Boolean(data.favorited) ||
    Boolean(data.is_favorite) ||
    (data.result === "exists") ||
    (data.in_favorites === true);
  const count =
    typeof data.count === "number" ? data.count :
    typeof data.total === "number" ? data.total :
    undefined;
  return (count !== undefined) ? { exists, count } : { exists };
}

function normalizeFavoriteToggleResponse(data) {
  if (!data || typeof data !== "object") return { exists: false };
  // Некоторые бэки возвращают action: "added" | "removed"
  const exists =
    Boolean(data.exists) ||
    Boolean(data.favorited) ||
    Boolean(data.favorite) ||
    Boolean(data.is_favorite) ||
    (data.action === "added") ||
    (data.in_favorites === true);
  const count =
    typeof data.count === "number" ? data.count :
    typeof data.total === "number" ? data.total :
    undefined;
  return (count !== undefined) ? { exists, count } : { exists };
}

// --- HTTP-помощники с ловлей 401 ---
async function getWith401(url, params) {
  try {
    const { data } = await http.get(url, { params });
    return data;
  } catch (e) {
    if (e?.response?.status === 401) {
      const err = new Error("unauthorized");
      err.__unauth = true;
      throw err;
    }
    throw e;
  }
}

async function postWith401(url, payload) {
  try {
    const { data } = await http.post(url, payload);
    return data;
  } catch (e) {
    if (e?.response?.status === 401) {
      const err = new Error("unauthorized");
      err.__unauth = true;
      throw err;
    }
    throw e;
  }
}

// --- Публичные функции V2 ---

/**
 * Проверка: материал с данным slug в «избранном»?
 * Каскадом пробуем современные ручки. 401 пробрасываем (чтоб компонент редиректил гостя).
 */
export async function favoritesCheckV2(slug) {
  if (!slug) return { exists: false };

  // 1) Современный query-вариант
  try {
    const data = await getWith401(`/favorites/check/`, { slug });
    return normalizeFavoriteCheckResponse(data);
  } catch (e) {
    if (e?.__unauth) throw e;
  }

  // 2) Path-стиль
  try {
    const data = await getWith401(`/favorites/check/${encodeURIComponent(slug)}/`);
    return normalizeFavoriteCheckResponse(data);
  } catch (e) {
    if (e?.__unauth) throw e;
  }

  // 3) Резерв: внутри /news/
  try {
    const data = await getWith401(`/news/favorites/check/`, { slug });
    return normalizeFavoriteCheckResponse(data);
  } catch (e) {
    if (e?.__unauth) throw e;
  }

  // Если ничего не сработало — просто «не в избранном», без выброса исключения
  return { exists: false };
}

/**
 * Переключение избранного по slug.
 */
export async function favoritesToggleV2(slug) {
  if (!slug) return { exists: false };

  // 1) Современный POST c body
  try {
    const data = await postWith401(`/favorites/toggle/`, { slug });
    return normalizeFavoriteToggleResponse(data);
  } catch (e) {
    if (e?.__unauth) throw e;
  }

  // 2) Path-стиль
  try {
    const data = await postWith401(`/favorites/toggle/${encodeURIComponent(slug)}/`, {});
    return normalizeFavoriteToggleResponse(data);
  } catch (e) {
    if (e?.__unauth) throw e;
  }

  // 3) Резерв: внутри /news/
  try {
    const data = await postWith401(`/news/favorites/toggle/`, { slug });
    return normalizeFavoriteToggleResponse(data);
  } catch (e) {
    if (e?.__unauth) throw e;
  }

  return { exists: false };
}
