/* Путь: frontend/src/components/auth/RequireAuth.jsx
   Назначение: Защита роутов по авторизации и ролям.
   Фикс:
     1) Любой аутентифицированный пользователь всегда получает роль "reader"
        (даже если backend возвращает role="user"/"authenticated" и т.п.).
     2) Защита от редиректа "в самого себя" (который даёт пустой экран).
*/

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { whoami, FRONTEND_LOGIN_URL } from "../../Api";

const ME_CACHE_TTL_MS = 30_000;

let meCache = {
  ts: 0,
  value: null,
  promise: null,
};

function toArrayMaybe(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function normalizeRoles(me) {
  const roles = new Set();

  if (!me) return roles;

  // 1) Сырые роли из API (поддерживаем разные форматы ответа)
  const rawRoles = [
    ...toArrayMaybe(me.roles),
    ...toArrayMaybe(me.role),
    ...toArrayMaybe(me.groups),
  ]
    .filter(Boolean)
    .map((x) => String(x).trim().toLowerCase());

  // 2) Маппинг “похожих” ролей / флагов
  for (const r of rawRoles) {
    if (["admin", "administrator", "superuser"].includes(r)) roles.add("admin");
    if (["editor", "redactor"].includes(r)) roles.add("editor");
    if (["author", "writer"].includes(r)) roles.add("author");

    // Частые варианты “обычного юзера”
    if (["user", "users", "authenticated", "member", "reader"].includes(r)) {
      roles.add("reader");
    }
  }

  // 3) Булевы флаги (часто есть в /me)
  if (me.is_superuser) roles.add("admin");
  if (me.is_staff) roles.add("admin"); // или editor — зависит от вашей политики

  // ✅ Главное правило: любой залогиненный = хотя бы reader
  roles.add("reader");

  return roles;
}

function isAllowedRole(userRolesSet, allowedRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return true; // нет ограничений
  if (allowedRoles.includes("*")) return true;

  for (const role of allowedRoles) {
    if (userRolesSet.has(String(role).toLowerCase())) return true;
  }
  return false;
}

async function getMeCached() {
  const now = Date.now();

  // свежий кэш
  if (meCache.value && now - meCache.ts < ME_CACHE_TTL_MS) {
    return meCache.value;
  }

  // уже идёт запрос
  if (meCache.promise) {
    return meCache.promise;
  }

  // новый запрос
  meCache.promise = (async () => {
    try {
      const res = await whoami();
      meCache.value = res;
      meCache.ts = Date.now();
      return res;
    } catch (err) {
      meCache.value = null;
      meCache.ts = Date.now();
      return null;
    } finally {
      meCache.promise = null;
    }
  })();

  return meCache.promise;
}

export default function RequireAuth({
  children,
  allowedRoles = ["reader"], // по умолчанию — хотя бы читатель
  redirectIfForbidden = "/dashboard/reader/",
}) {
  const location = useLocation();
  const [state, setState] = React.useState({
    loading: true,
    me: null,
  });

  React.useEffect(() => {
    let alive = true;

    (async () => {
      const me = await getMeCached();
      if (!alive) return;
      setState({ loading: false, me });
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div style={{ padding: 24 }}>
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          Проверяем доступ…
        </div>
      </div>
    );
  }

  const me = state.me;

  // не залогинен
  if (!me) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${FRONTEND_LOGIN_URL}?next=${next}`} replace />;
  }

  // залогинен, проверяем роли
  const rolesSet = normalizeRoles(me);

  if (!isAllowedRole(rolesSet, allowedRoles)) {
    // защита от редиректа “в самого себя”, который даёт пустой экран
    const target =
      redirectIfForbidden === location.pathname ? "/" : redirectIfForbidden;

    return <Navigate to={target} replace />;
  }

  return children;
}
