/* Путь: frontend/src/App.js
   Назначение: Корневой компонент SPA IzotovLife с поддержкой коротких SEO-путей и кабинетами.

   FIX (2026-01-06):
   ✅ УБРАНО: useLocation / ScrollToTopOnRouteChange (могло дать белый экран, если App оказался вне Router)
   ✅ УБРАНО: GaRouteTracker на useLocation (по той же причине)
   ✅ ДОБАВЛЕНО: универсальный SPA listener через history.pushState/replaceState/popstate:
       - скролл вверх при навигации
       - GA4 page_view при навигации (без дубля первого просмотра)

   FIX (2026-01-31-AUTHOR-ARTICLES-ROUTE):
   ✅ Добавлены новые SEO-роуты для авторских публикаций:
       /articles/:username/:slug
       /articles/:username/:slug/
       /articles
       /articles/
   ✅ Роуты размещены ВЫШЕ универсальных /:slug и /:category/:slug,
      чтобы их не перехватывал CategoryPage/NewsDetailPage по общим маскам.

   ADD (2026-02-08D-AUTHOR-CHANNEL-SETTINGS):
   ✅ Добавлена страница настроек "канала" автора (как Дзен):
      /dashboard/author/channel
      /dashboard/author/channel/
   ✅ Роуты под RequireAuth (author/editor/admin) — рядом с кабинетом автора.

   ADD (2026-02-08E-PUBLIC-CHANNEL-ROUTE):
   ✅ Публичный роут канала: /u/:id/ (канонический)
      - Это не конфликтует с /:slug (категории), потому что имеет префикс /u/
      - Пока используем AuthorPage как рендерер (он умеет fallback)

   FIX (2026-02-15-AUTHOR-MATERIALS-OPEN):
   ✅ Явный роут /avtorskie-materialy(/) ведёт в CategoryPage с forcedSlug,
      чтобы категория открывалась как категория (а не режим "категории"/пусто из-за params.slug undefined).
*/

import React from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";

import SmartDashboardRedirect from "./components/SmartDashboardRedirect";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HeaderInfo from "./components/HeaderInfo";

import FeedPage from "./pages/FeedPage";
import CategoryPage from "./pages/CategoryPage"; // /:slug
import CategoriesPage from "./pages/CategoryPage"; // /categories (легаси-совмещение)
import NewsDetailPage from "./pages/NewsDetailPage";
import SearchPage from "./pages/SearchPage";
import AuthorPage from "./pages/AuthorPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import StaticPage from "./pages/StaticPage";
import SuggestPage from "./pages/SuggestPage";

import ReaderPage from "./pages/ReaderPage";
import AuthorDashboard from "./pages/AuthorDashboard";
import EditorDashboard from "./pages/EditorDashboard";

// ✅ ADD: Настройки канала автора
import AuthorChannelSettingsPage from "./pages/AuthorChannelSettingsPage";

import HoroscopePage from "./pages/HoroscopePage";
import NotFoundPage from "./pages/NotFoundPage";

import RequireAuth from "./components/auth/RequireAuth";

// ✅ Новое: безопасная навигация SPA без зависимостей от Router hooks
import { installNavigationEvents } from "./utils/spaNavigation";
import { gaPageView } from "./analytics/ga";

// === Глобальная база backend API (для прокси-редиректов активации) ===
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

// -------------------------------------------------------
// Редиректы для старых URL новостей
// -------------------------------------------------------
function RedirectToCleanNews() {
  const params = useParams();
  const values = Object.values(params).filter(Boolean);
  const slug = values[values.length - 1];
  return <Navigate to={`/${slug}/`} replace />;
}

// -------------------------------------------------------
// Прокси-страница активации аккаунта
// -------------------------------------------------------
function ActivationProxy() {
  const { uid, token } = useParams();

  React.useEffect(() => {
    if (!uid || !token) return;
    const safeUid = encodeURIComponent(uid);
    const safeToken = encodeURIComponent(token);
    const url = `${API_BASE}/api/auth/activate/${safeUid}/${safeToken}/?html=1`;
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
  // ✅ Безопасный трекинг навигации и скролла (работает даже если Router сломан)
  React.useEffect(() => {
    installNavigationEvents();

    let first = true;

    const onNavigate = () => {
      try {
        window.scrollTo({ top: 0, behavior: "instant" });
      } catch (e) {
        window.scrollTo(0, 0);
      }

      if (first) {
        first = false;
        return;
      }

      const path = window.location.pathname + window.location.search;
      gaPageView(path);
    };

    window.addEventListener("izotovlife:navigate", onNavigate);

    try {
      window.dispatchEvent(new Event("izotovlife:navigate"));
    } catch (e) {}

    return () => {
      window.removeEventListener("izotovlife:navigate", onNavigate);
    };
  }, []);

  return (
    <div className="App">
      <Navbar />
      <HeaderInfo compact={true} />

      <main className="appMain">
        <Routes>
          {/* 🏠 Главная */}
          <Route path="/" element={<FeedPage />} />

          {/* ===================== КАБИНЕТЫ ===================== */}
          <Route
            path="/dashboard/reader"
            element={
              <RequireAuth allowedRoles={["reader", "author", "editor", "admin"]}>
                <ReaderPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/reader/"
            element={
              <RequireAuth allowedRoles={["reader", "author", "editor", "admin"]}>
                <ReaderPage />
              </RequireAuth>
            }
          />

          <Route
            path="/dashboard/author"
            element={
              <RequireAuth allowedRoles={["author", "editor", "admin"]}>
                <AuthorDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/author/"
            element={
              <RequireAuth allowedRoles={["author", "editor", "admin"]}>
                <AuthorDashboard />
              </RequireAuth>
            }
          />

          {/* ✅ ADD: Настройки "канала" автора (как Дзен) */}
          <Route
            path="/dashboard/author/channel"
            element={
              <RequireAuth allowedRoles={["author", "editor", "admin"]}>
                <AuthorChannelSettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/author/channel/"
            element={
              <RequireAuth allowedRoles={["author", "editor", "admin"]}>
                <AuthorChannelSettingsPage />
              </RequireAuth>
            }
          />

          <Route
            path="/dashboard/editor"
            element={
              <RequireAuth allowedRoles={["editor", "admin"]}>
                <EditorDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/editor/"
            element={
              <RequireAuth allowedRoles={["editor", "admin"]}>
                <EditorDashboard />
              </RequireAuth>
            }
          />

          <Route path="/dashboard" element={<SmartDashboardRedirect />} />
          <Route path="/dashboard/" element={<SmartDashboardRedirect />} />

          {/* Легаси-синонимы кабинетов */}
          <Route path="/cabinet" element={<SmartDashboardRedirect />} />
          <Route path="/cabinet/" element={<SmartDashboardRedirect />} />
          <Route path="/reader" element={<SmartDashboardRedirect />} />
          <Route path="/reader/" element={<SmartDashboardRedirect />} />
          <Route path="/author-dashboard" element={<Navigate to="/dashboard/author/" replace />} />
          <Route path="/author-dashboard/" element={<Navigate to="/dashboard/author/" replace />} />
          <Route path="/editor-dashboard" element={<Navigate to="/dashboard/editor/" replace />} />
          <Route path="/editor-dashboard/" element={<Navigate to="/dashboard/editor/" replace />} />

          {/* Легаси под /author/* → редиректы на кабинеты */}
          <Route path="/author/dashboard" element={<Navigate to="/dashboard/author/" replace />} />
          <Route path="/author/dashboard/" element={<Navigate to="/dashboard/author/" replace />} />
          <Route path="/author/editor" element={<Navigate to="/dashboard/editor/" replace />} />
          <Route path="/author/editor/" element={<Navigate to="/dashboard/editor/" replace />} />
          <Route path="/author/reader" element={<SmartDashboardRedirect />} />
          <Route path="/author/reader/" element={<SmartDashboardRedirect />} />

          {/* 🔍 Поиск */}
          <Route path="/search" element={<SearchPage />} />
          <Route path="/search/" element={<SearchPage />} />

          {/* ✅ Публичные страницы автора/канала */}
          <Route path="/u/:id" element={<AuthorPage />} />
          <Route path="/u/:id/" element={<AuthorPage />} />

          <Route path="/author/:id" element={<AuthorPage />} />
          <Route path="/author/:id/" element={<AuthorPage />} />

          {/* 🔐 Авторизация и статические */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/register/" element={<RegisterPage />} />
          <Route path="/pages/:slug" element={<StaticPage />} />
          <Route path="/pages/:slug/" element={<StaticPage />} />

          {/* 📨 Предложить новость */}
          <Route path="/suggest" element={<SuggestPage />} />
          <Route path="/suggest/" element={<SuggestPage />} />

          {/* 🔮 Гороскоп */}
          <Route path="/horoscope" element={<HoroscopePage />} />
          <Route path="/horoscope/" element={<HoroscopePage />} />

          {/* ✅ Активация аккаунта */}
          <Route path="/activate/:uid/:token" element={<ActivationProxy />} />
          <Route path="/activate/:uid/:token/" element={<ActivationProxy />} />
          <Route path="/registration/confirm/:uid/:token" element={<ActivationProxy />} />
          <Route path="/registration/confirm/:uid/:token/" element={<ActivationProxy />} />

          {/* ✅ SEO-роуты авторских публикаций */}
          <Route path="/articles" element={<FeedPage />} />
          <Route path="/articles/" element={<FeedPage />} />
          <Route path="/articles/:username/:slug" element={<NewsDetailPage />} />
          <Route path="/articles/:username/:slug/" element={<NewsDetailPage />} />

          {/* 📰 Детальные новости */}
          <Route path="/news/source/:source/:slug" element={<NewsDetailPage />} />
          <Route path="/news/source/:source/:slug/" element={<NewsDetailPage />} />
          <Route path="/news/:category/:slug" element={<NewsDetailPage />} />
          <Route path="/news/:category/:slug/" element={<NewsDetailPage />} />
          <Route path="/news/:slug" element={<NewsDetailPage />} />
          <Route path="/news/:slug/" element={<NewsDetailPage />} />

          <Route path="/a/:slug" element={<NewsDetailPage />} />
          <Route path="/a/:slug/" element={<NewsDetailPage />} />

          {/* ✅ Список категорий */}
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/categories/" element={<CategoriesPage />} />

          {/* ✅ /news и /news/ должны быть ВЫШЕ универсальных /:slug */}
          <Route path="/news" element={<FeedPage />} />
          <Route path="/news/" element={<FeedPage />} />

          {/* ✅ FIX: Авторские материалы — отдельный маршрут с forcedSlug */}
          <Route
            path="/avtorskie-materialy"
            element={<CategoryPage forcedSlug="avtorskie-materialy" />}
          />
          <Route
            path="/avtorskie-materialy/"
            element={<CategoryPage forcedSlug="avtorskie-materialy" />}
          />

          {/* ✅ Категория по SEO-слугу */}
          <Route path="/:slug" element={<CategoryPage />} />
          <Route path="/:slug/" element={<CategoryPage />} />

          {/* ✅ Детальная новость по короткому пути */}
          <Route path="/:category/:slug" element={<NewsDetailPage />} />
          <Route path="/:category/:slug/" element={<NewsDetailPage />} />

          {/* ===== Легаси редиректы новостей ===== */}
          <Route path="/rss/:slug" element={<RedirectToCleanNews />} />
          <Route path="/rss/:slug/" element={<RedirectToCleanNews />} />

          <Route path="/news/a/:slugOrId" element={<RedirectToCleanNews />} />
          <Route path="/news/a/:slugOrId/" element={<RedirectToCleanNews />} />

          <Route path="/news/i/:slugOrId" element={<RedirectToCleanNews />} />
          <Route path="/news/i/:slugOrId/" element={<RedirectToCleanNews />} />

          <Route path="/news/imported/:sourceSlug/:importedSlug" element={<RedirectToCleanNews />} />
          <Route
            path="/news/imported/:sourceSlug/:importedSlug/"
            element={<RedirectToCleanNews />}
          />

          <Route path="/news/:sourceSlug/:importedSlug" element={<RedirectToCleanNews />} />
          <Route path="/news/:sourceSlug/:importedSlug/" element={<RedirectToCleanNews />} />

          {/* 🚧 Фолбэк */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}
