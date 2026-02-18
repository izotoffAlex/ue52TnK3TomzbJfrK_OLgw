/* Путь: frontend/src/api/ApiFavorites.js
   Назначение: Мини-API для избранного на фронте.
   Особенности:
     - База API из REACT_APP_API_BASE или http://localhost:8000/api
     - credentials: 'include' для куки-сессии, плюс Bearer если он есть
*/

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000/api";

function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function checkAuth() {
  const endpoints = [`${API_BASE}/auth/whoami/`, `${API_BASE}/users/me/`];
  for (const url of endpoints) {
    try {
      const r = await fetch(url, { credentials: "include", headers: authHeaders() });
      if (r.ok) return await r.json();
    } catch {}
  }
  return null;
}

export async function favoriteCheck(slug) {
  if (!slug) return false;
  try {
    const r = await fetch(`${API_BASE}/news/favorites/check/?slug=${encodeURIComponent(slug)}`, {
      credentials: "include",
      headers: authHeaders(),
    });
    if (!r.ok) return false;
    const d = await r.json();
    return Boolean(d?.favorite ?? d?.is_favorite ?? false);
  } catch { return false; }
}

export async function favoriteToggle(slug) {
  if (!slug) throw new Error("slug is required");
  const r = await fetch(`${API_BASE}/news/favorites/toggle/`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify({ slug }),
  });
  if (r.status === 401) throw new Error("AUTH_REQUIRED");
  if (!r.ok) throw new Error(`Favorite toggle failed: ${r.status}`);
  const d = await r.json();
  return Boolean(d?.favorite ?? d?.is_favorite ?? false);
}

export async function favoritesList() {
  try {
    const r = await fetch(`${API_BASE}/news/favorites/`, { credentials: "include", headers: authHeaders() });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
  } catch { return []; }
}
