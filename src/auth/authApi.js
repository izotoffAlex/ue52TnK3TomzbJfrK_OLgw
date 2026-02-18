/* Путь: frontend/src/auth/authApi.js
   Назначение: API-методы авторизации.
   Работает с эндпоинтами:
     - POST /api/auth/login/
     - GET  /api/auth/me/
   Логин сохраняет токен(ы) в localStorage.
*/

import { api } from "../api/http";
import { setTokens, clearTokens } from "./tokenStorage";

/**
 * Пытаемся "угадать" поля ответа логина:
 * - access / refresh (SimpleJWT)
 * - token / key (некоторые реализации)
 */
function extractTokens(loginResponseData) {
  const d = loginResponseData || {};
  const access = d.access || d.token || d.key || "";
  const refresh = d.refresh || "";
  return { access, refresh };
}

export async function login({ emailOrUsername, password }) {
  // На бэке у тебя может быть username/email — поэтому отправляем оба поля.
  // Сервер просто возьмёт то, что поддерживает.
  const payload = {
    username: emailOrUsername,
    email: emailOrUsername,
    password,
  };

  const res = await api.post("/api/auth/login/", payload);

  const tokens = extractTokens(res.data);
  if (tokens.access || tokens.refresh) {
    setTokens(tokens);
  }

  // Сразу проверим "кто я" (если токен нужен — он уже будет в interceptor)
  const me = await getMe().catch(() => null);

  return { ok: true, tokens, me, raw: res.data };
}

export async function getMe() {
  const res = await api.get("/api/auth/me/");
  return res.data;
}

export function logout() {
  // На бэке может быть /api/auth/logout/ — но даже без него удаление токена = выход.
  clearTokens();
}
