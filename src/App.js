// Путь: frontend/src/App.js
// Назначение: Корневой компонент SPA IzotovLife с поддержкой коротких SEO-путей.
// Исправлено:
//   ✅ Категории теперь открываются по /<slug>/ (например /politika/).
//   ✅ /categories отображает сетку всех категорий.
//   ✅ Старые пути /news/category/... и /category/... редиректят на новый формат.
//   ✅ Удалён несуществующий импорт CategoriesPage.js.
//   ✅ Правильный порядок маршрутов (специфические → общие).
//   ✅ Полная совместимость с Django backend.
// Дополнения (ничего не удаляя):
//   ✅ Маршруты-посредники для активации аккаунта из письма:
//        /activate/:uid/:token   и   /registration/confirm/:uid/:token
//      Эти маршруты делают мгновенный редирект на backend /api/auth/activate/... (с красивой HTML-страницей)
//   ✅ Компонент ScrollToTopOnRouteChange — прокрутка к началу при смене маршрута
//   ✅ Переменная API_BASE берётся из REACT_APP_API_BASE или по умолчанию http://localhost:8000

import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams, // ✅ добавлено
} from "react-router-dom";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HeaderInfo from "./components/HeaderInfo";

import FeedPage from "./pages/FeedPage";
import CategoryPage from "./pages/CategoryPage"; // ✅ единый компонент категорий
import NewsDetailPage from "./pages/NewsDetailPage";
import SearchPage from "./pages/SearchPage";
import AuthorPage from "./pages/AuthorPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import StaticPage from "./pages/StaticPage";
import SuggestPage from "./pages/SuggestPage";

// === Глобальная база backend API (для редиректов в прокси-страницах) ===
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

// --- Редиректы для старых URL ---
function RedirectToCleanNews() {
  const location = useLocation();
  const parts = location.pathname.split("/").filter(Boolean);
  const slug = parts[parts.length - 1];
  return <Navigate to={`/${slug}/`} replace />;
}

function RedirectOldCategory() {
  const slug = window.location.pathname.split("/").pop();
  return <Navigate to={`/${slug}/`} replace />;
}

// --- Прокрутка к началу при смене маршрута (UX приятнее) ---
function ScrollToTopOnRouteChange() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
  return null;
}

// --- Прокси-страница активации аккаунта ---
// Зачем: некоторые письма/ссылки могут вести на фронтовой маршрут /activate/:uid/:token
// Компонент моментально перенаправит браузер на backend-эンドпоинт,
// который покажет красивую HTML-страницу и затем редиректит на /login.
function ActivationProxy() {
  const { uid, token } = useParams();
  React.useEffect(() => {
    if (!uid || !token) return;
    const url = `${API_BASE}/api/auth/activate/${uid}/${token}/?html=1`;
    // Используем replace, чтобы не было "назад" на промежуточную страницу
    window.location.replace(url);
  }, [uid, token]);
  return (
    <div style={{ maxWidth: 520, margin: "40px auto", color: "#e6eefc" }}>
      <div
        style={{
          background: "#111a2b",
          padding: 24,
          borderRadius: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Подтверждение регистрации…</h1>
        <p>Перенаправляем вас на страницу активации аккаунта.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ScrollToTopOnRouteChange />
      <div className="App">
        <Navbar />
        <HeaderInfo compact={true} />

        <Routes>
          {/* 🏠 Главная страница */}
          <Route path="/" element={<FeedPage />} />

          {/* 🗂️ Старые пути категорий → редирект */}
          <Route path="/news/category/:slug" element={<RedirectOldCategory />} />
          <Route path="/category/:slug" element={<RedirectOldCategory />} />

          {/* 🔍 Поиск, авторы и прочие страницы */}
          <Route path="/search" element={<SearchPage />} />
          <Route path="/author/:id" element={<AuthorPage />} />

          {/* 📰 Детальные новости (для обратной совместимости) */}
          <Route path="/news/source/:source/:slug" element={<NewsDetailPage />} />
          <Route path="/news/:category/:slug" element={<NewsDetailPage />} />
          <Route path="/news/:slug" element={<NewsDetailPage />} />

          {/* ✅ Новые короткие пути */}
          {/* Категории верхнего уровня */}
          <Route path="/categories" element={<CategoryPage />} />
          <Route path="/:slug/" element={<CategoryPage />} />

          {/* Детальные новости по коротким путям (например /politika/rossiya-startuet/) */}
          <Route path="/:category/:slug/" element={<NewsDetailPage />} />

          {/* ===== Легаси редиректы ===== */}
          <Route path="/rss/:slug" element={<RedirectToCleanNews />} />
          <Route path="/news/a/:slugOrId" element={<RedirectToCleanNews />} />
          <Route path="/news/i/:slugOrId" element={<RedirectToCleanNews />} />
          <Route
            path="/news/imported/:sourceSlug/:importedSlug"
            element={<RedirectToCleanNews />}
          />
          <Route
            path="/news/:sourceSlug/:importedSlug"
            element={<RedirectToCleanNews />}
          />

          {/* 🔐 Авторизация и статические страницы */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/pages/:slug" element={<StaticPage />} />

          {/* 📨 Предложить новость */}
          <Route path="/suggest" element={<SuggestPage />} />

          {/* ✅ Посредники активации аккаунта (фронтовые дружелюбные URL) */}
          <Route path="/activate/:uid/:token" element={<ActivationProxy />} />
          {/* Alias для старых писем: /registration/confirm/<uid>/<token> */}
          <Route
            path="/registration/confirm/:uid/:token"
            element={<ActivationProxy />}
          />

          {/* 🚧 Фолбэк на главную */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Footer />
      </div>
    </Router>
  );
}
