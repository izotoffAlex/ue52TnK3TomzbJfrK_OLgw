// Путь: frontend/src/pages/LoginPage.js
// Назначение: Форма входа.
// Суперпользователь → редирект в Django admin через одноразовый admin_url.
// Все остальные → используем redirect_url из бэка, а если его нет — отправляем в /dashboard/.
// Дополнительно:
//   ✅ Сохраняем JWT access в localStorage (переживает перезагрузку)
//   ✅ При открытии страницы подхватываем токен из localStorage и прокидываем в setToken()
//   ✅ navigate(..., { replace:true }) чтобы не было "скачков" назад

import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, Link } from "react-router-dom";
import { setToken, login, whoami, adminSessionLogin } from "../Api";

const LS_ACCESS_KEY = "izotovlife_access_token"; // ключ для сохранения access токена

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // Подхватываем токен при заходе на страницу
  useEffect(() => {
    try {
      const savedAccess = localStorage.getItem(LS_ACCESS_KEY);
      if (savedAccess) {
        setToken(savedAccess);
      }
    } catch (e) {
      console.warn("localStorage недоступен:", e);
    }
  }, []);

  const safeNavigate = (to) => {
    if (typeof to === "string" && /^https?:\/\//i.test(to)) {
      window.location.href = to;
      return;
    }
    navigate(to, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      // 1) Логин: получаем JWT + данные пользователя
      const res = await login(username, password);
      console.log("LOGIN RESULT:", res);

      // 2) Сохраняем токен
      if (res?.access) {
        setToken(res.access);
        try {
          localStorage.setItem(LS_ACCESS_KEY, res.access);
        } catch (e2) {
          console.warn("Не удалось сохранить токен в localStorage:", e2);
        }
      } else {
        console.warn("login() не вернул access token:", res);
      }

      // 3) Пользователь из ответа логина
      const userFromLogin = res && res.user ? res.user : null;
      console.log("USER FROM LOGIN:", userFromLogin);

      // 4) Если это суперпользователь — сразу магическая ссылка в админку
      if (userFromLogin && userFromLogin.is_superuser) {
        try {
          const sec = await adminSessionLogin();
          console.log("ADMIN SESSION LOGIN RESULT:", sec);

          const adminUrl =
            (sec &&
              (sec.admin_url || sec.admin_entry_url || sec.url)) ||
            null;

          if (adminUrl) {
            window.location.href = adminUrl;
          } else {
            setError("Не удалось получить ссылку для входа в админку.");
          }
        } catch (e4) {
          console.error("Ошибка adminSessionLogin:", e4);
          setError("Ошибка при подготовке входа в админку.");
        }
        return;
      }

      // 5) Если не суперпользователь — обычный поток
      //    (берём redirect_url из whoami/бэка, иначе /dashboard/)
      const meRes = await whoami();
      console.log("WHOAMI RESULT:", meRes);

      const target =
        meRes && meRes.redirect_url ? meRes.redirect_url : "/dashboard/";
      safeNavigate(target);
    } catch (err) {
      console.error("Ошибка входа:", err);
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Ошибка входа. Попробуйте снова."
      );
    } finally {
      setBusy(false);
    }
  };

  // базовый URL бэкенда (для редиректов на allauth)
  const backendUrl =
    process.env.REACT_APP_BACKEND_URL || "https://izotovlife.ru";

  return (
    <>
      <Helmet>
        <title>Вход — IzotovLife</title>
        <meta
          name="description"
          content="Вход на сайт IzotovLife: авторизация по логину или e-mail, доступ к личному кабинету, избранным новостям и настройкам профиля. Поддерживается вход через VK, Яндекс и Google."
        />
      </Helmet>

      <div className="max-w-md mx-auto mt-10 bg-[var(--bg-card)] p-6 rounded-xl shadow">
        <h1 className="text-xl font-bold mb-4 text-white">Вход</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Логин или Email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-2 rounded border border-gray-600 bg-transparent text-white"
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 rounded border border-gray-600 bg-transparent text-white"
            autoComplete="current-password"
          />

          {error && <div className="text-red-400 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-bold disabled:opacity-60"
          >
            {busy ? "Входим..." : "Войти"}
          </button>
        </form>

        <div className="mt-4 flex justify-between text-sm text-gray-300">
          <Link to="/register" className="hover:underline">
            Регистрация
          </Link>
          <Link to="/reset-password" className="hover:underline">
            Забыли пароль?
          </Link>
        </div>

        <div className="mt-6">
          <p className="text-center text-gray-400 mb-2">или войдите через:</p>
          <div className="flex flex-col gap-2">
            <a
              href={`${backendUrl}/accounts/vk/login/`}
              className="w-full py-2 rounded text-white font-bold text-center bg-[#4a76a8] hover:opacity-90"
            >
              Войти через VK
            </a>
            <a
              href={`${backendUrl}/accounts/yandex/login/`}
              className="w-full py-2 rounded text-black font-bold text-center bg-[#ffcc00] hover:opacity-90"
            >
              Войти через Яндекс
            </a>
            <a
              href={`${backendUrl}/accounts/google/login/`}
              className="w-full py-2 rounded text-white font-bold text-center bg-[#db4437] hover:opacity-90"
            >
              Войти через Google
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
