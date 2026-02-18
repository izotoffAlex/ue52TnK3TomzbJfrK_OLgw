/* Путь: frontend/src/auth/tokenStorage.js
   Назначение: хранение JWT/токена в localStorage (просто и надёжно).
   Важно: это не HttpOnly cookie, но для SPA — нормальный стартовый вариант.
*/

const ACCESS_KEY = "izotovlife_access_token";
const REFRESH_KEY = "izotovlife_refresh_token";

export function setTokens({ access, refresh }) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY) || "";
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) || "";
}
