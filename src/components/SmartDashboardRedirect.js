// Путь: frontend/src/components/SmartDashboardRedirect.js
// Назначение: Умный редирект с /dashboard* и алиасов.
//   - staff/superuser -> /admin/
//   - иначе -> /dashboard/reader/
//
// Механика: пробуем получить текущего пользователя через несколько возможных эндпоинтов.
// Если не получилось — считаем, что это обычный пользователь.

import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

const ME_URLS = [
  "/api/accounts/me/",
  "/api/accounts/profile/",
  "/api/accounts/user/",
  "/api/auth/user/",
  "/api/users/me/",
];

async function fetchJSON(url) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) return null;
  const ct = (r.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

function extractFlags(payload) {
  if (!payload) return { is_staff: false, is_superuser: false };

  // варианты: {is_staff, is_superuser} или {user: {...}} или {data: {...}}
  const obj =
    payload.user && typeof payload.user === "object" ? payload.user :
    payload.data && typeof payload.data === "object" ? payload.data :
    payload;

  return {
    is_staff: !!obj.is_staff,
    is_superuser: !!obj.is_superuser,
  };
}

export default function SmartDashboardRedirect() {
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState({ is_staff: false, is_superuser: false });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        for (const url of ME_URLS) {
          const data = await fetchJSON(url);
          if (data) {
            const f = extractFlags(data);
            if (alive) setFlags(f);
            break;
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, []);

  if (loading) return null;

  if (flags.is_staff || flags.is_superuser) {
    // В админку уходим “жёстко”, чтобы не ломать SPA-роутинг
    window.location.href = "/admin/";
    return null;
  }

  return <Navigate to="/dashboard/reader/" replace />;
}
