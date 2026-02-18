// Путь: frontend/src/pages/AuthorPage.js
// Назначение: Публичная страница автора (обложка/аватар/описание + список опубликованных статей).
//
// FIX 2026-02-08E (API CONSISTENCY + DZEN CHANNEL ROUTE SUPPORT):
// ✅ AuthorPage теперь использует НОВЫЕ функции из frontend/src/Api.js:
//    - getAuthorPublic()
//    - getAuthorPublicArticles()
// ✅ Убрана зависимость от "../api/dashboards" (listPublicArticlesByAuthor/__dashDbg) — их нет в Api.js.
// ✅ Фолбэк-профиль: если профиль не найден — страница НЕ падает, а показывает "минимальный" профиль.
// ✅ Ссылки на деталь авторских статей строятся канонически: /articles/<login>/<slug>/
// ✅ Служебные пути /author/dashboard|editor|reader|me остаются с редиректом на /dashboard/*
// ✅ DEBUG (?debug=1): показывает ключ автора и сообщения (без списка пробованных URL — их теперь не собираем).

import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { getAuthorPublic, getAuthorPublicArticles } from "../Api";

function formatDate(iso) {
  if (!iso) return "Без даты";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "Без даты";
  }
}

function pickCover(x) {
  return (
    x?.cover ||
    x?.cover_image ||
    x?.cover_url ||
    x?.image ||
    x?.header ||
    x?.banner ||
    x?.channel_cover ||
    ""
  );
}

function pickAvatar(x) {
  return x?.avatar || x?.photo || x?.image || x?.logo || x?.channel_avatar || "";
}

function pickName(author) {
  const fn = (author?.first_name || "").trim();
  const ln = (author?.last_name || "").trim();
  const full = [fn, ln].filter(Boolean).join(" ");
  return (
    full ||
    author?.channel_title ||
    author?.display_name ||
    author?.username ||
    author?.login ||
    author?.name ||
    author?.slug ||
    "Автор"
  );
}

function pickAuthorLoginFromArticleOrProfile(article, profile, routeParam) {
  // 1) из статьи
  const aUser = article?.author?.username || "";
  if (String(aUser).trim()) return String(aUser).trim();

  const aLogin =
    article?.author_login ||
    article?.author_username ||
    article?.author_slug ||
    article?.author?.login ||
    "";
  if (String(aLogin).trim()) return String(aLogin).trim();

  // 2) из профиля автора
  const pUser = profile?.username || profile?.login || "";
  if (String(pUser).trim()) return String(pUser).trim();

  const pSlug =
    profile?.channel_slug ||
    profile?.slug ||
    profile?.login ||
    profile?.author_login ||
    "";
  if (String(pSlug).trim()) return String(pSlug).trim();

  // 3) из URL страницы автора
  const rp = String(routeParam || "").trim();
  if (rp) return rp;

  // 4) fallback
  return "Izotovlife";
}

function buildDetailHref(article, authorProfile, routeParam) {
  const slug = (article?.slug || article?.seo_slug || article?.url_slug || "").trim();
  if (!slug) return "#";
  const login = pickAuthorLoginFromArticleOrProfile(article, authorProfile, routeParam)
    .replace(/^\/+|\/+$/g, "");
  return `/articles/${encodeURIComponent(login)}/${encodeURIComponent(slug)}/`;
}

export default function AuthorPage() {
  // ВАЖНО:
  // App.js может вести сюда как /author/:id/ так и /u/:slug/
  // Поэтому читаем param как "id" (из /author/:id) или "slug" (из /u/:slug)
  const params = useParams();
  const routeParam = params.id || params.slug || "";

  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const debug = sp.get("debug") === "1";

  const [author, setAuthor] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  // мягкие сообщения (не фатальные)
  const [note, setNote] = useState("");
  const [fatalErr, setFatalErr] = useState("");

  // распознаём «служебные» слова
  const routeKind = useMemo(() => {
    const v = String(routeParam || "").toLowerCase();
    if (["dashboard", "me"].includes(v)) return "author-dashboard";
    if (v === "editor") return "editor-dashboard";
    if (v === "reader") return "reader-dashboard";
    return null;
  }, [routeParam]);

  // моментальный редирект с «служебных» путей
  useEffect(() => {
    if (!routeKind) return;
    const map = {
      "author-dashboard": "/dashboard/author/",
      "editor-dashboard": "/dashboard/editor/",
      "reader-dashboard": "/dashboard/reader/",
    };
    const to = map[routeKind];
    if (to) navigate(to, { replace: true });
  }, [routeKind, navigate]);

  useEffect(() => {
    if (routeKind) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setFatalErr("");
      setNote("");

      const key = String(routeParam || "").trim();
      if (!key) {
        setFatalErr("Не задан параметр автора");
        setLoading(false);
        return;
      }

      // Минимальный профиль на случай отсутствия эндпоинта профиля
      const minimalAuthor = {
        username: key,
        login: key,
        display_name: key,
        channel_slug: key,
        channel_title: key,
        slug: key,
        bio: "",
        description: "",
        photo: "",
        cover: "",
      };

      // 1) Профиль (не обязателен)
      try {
        const profile = await getAuthorPublic(key);
        if (cancelled) return;
        setAuthor(profile || minimalAuthor);
      } catch (e) {
        if (cancelled) return;
        setAuthor(minimalAuthor);
        setNote(
          "Профиль автора не найден в API (локалка/бэк не настроен). Показан упрощённый профиль."
        );
        if (debug) console.warn("AuthorPage: getAuthorPublic fallback:", e);
      }

      // 2) Статьи (желательно, но не делаем фаталом, чтобы страница не была “пустой ошибкой”)
      try {
        const arts = await getAuthorPublicArticles(key);
        if (cancelled) return;
        const list = Array.isArray(arts) ? arts : arts?.results || arts?.items || [];
        setArticles(Array.isArray(list) ? list : []);
      } catch (e) {
        if (cancelled) return;
        setArticles([]);
        const msg = e?.response?.data?.detail || e?.message || "Не удалось загрузить статьи автора";
        // мягко, не “красной смертью”
        setNote((prev) => (prev ? prev : msg));
        if (debug) console.warn("AuthorPage: getAuthorPublicArticles error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeParam, routeKind, debug]);

  if (routeKind) return null;

  if (loading) return <div className="p-4">Загрузка…</div>;

  // если вообще ничего не получилось (ни профиль-фолбэк, ни что-то ещё)
  if (!author && fatalErr) {
    return <div className="p-4">{fatalErr}</div>;
  }

  const authorCover = pickCover(author);
  const authorAvatar = pickAvatar(author);
  const authorName = pickName(author);

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* DEBUG блок (включается ?debug=1) */}
      {debug && (
        <div className="mb-4 p-3 rounded border border-yellow-600 text-yellow-300 bg-black/40">
          <div className="font-semibold mb-1">DEBUG AuthorPage</div>
          <div>
            <b>routeParam:</b> {String(routeParam)}
          </div>
          <div>
            <b>routeKind:</b> {String(routeKind)}
          </div>
          <div className="mt-2 text-sm opacity-90">
            Примечание: список “пробованных URL” больше не показываем, потому что запросы идут через Api.js без debug-trace.
          </div>
        </div>
      )}

      {/* Мягкое уведомление (не ошибка) */}
      {note && (
        <div className="mb-4 p-3 rounded border border-slate-600 text-slate-200 bg-black/20">
          {note}
        </div>
      )}

      {/* Обложка автора */}
      {authorCover && (
        <div className="mb-4">
          <img
            src={authorCover}
            alt=""
            className="w-full h-48 object-cover rounded-md"
            loading="lazy"
          />
        </div>
      )}

      {/* Профиль */}
      <div className="flex items-center gap-4 mb-6">
        {authorAvatar ? (
          <img
            src={authorAvatar}
            alt={authorName}
            className="w-20 h-20 rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-xl">
            👤
          </div>
        )}

        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{authorName}</h1>
          {(author?.bio || author?.description) && (
            <p className="text-gray-400">{author.bio || author.description}</p>
          )}
          <div className="text-sm text-gray-500 mt-1">
            Канал: <span className="font-mono">{String(routeParam)}</span>
          </div>
        </div>
      </div>

      {/* Статьи */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Статьи автора</h2>
      </div>

      {articles.length === 0 ? (
        <p className="text-gray-500">У этого автора пока нет опубликованных статей.</p>
      ) : (
        <div className="space-y-4">
          {articles.map((a) => {
            const cov = pickCover(a);
            const href = buildDetailHref(a, author, routeParam);
            return (
              <div
                key={a.id || a.slug || `${a.title}-${Math.random()}`}
                className="p-4 border rounded hover:shadow"
              >
                {cov && (
                  <img
                    src={cov}
                    alt=""
                    className="w-full h-44 object-cover mb-2 rounded"
                    loading="lazy"
                  />
                )}
                <Link to={href} className="text-lg font-bold text-blue-600 hover:underline">
                  {a.title || a.name || a.slug}
                </Link>
                <div className="text-sm text-gray-500">
                  {formatDate(a.published_at || a.created_at || a.updated_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
