// Путь: frontend/src/pages/NewsDetailPage.js
// Назначение: Детальная страница новости (Article или ImportedNews).
// Это восстановленная версия "как 30 минут назад":
//   ✅ Деталь берём ТОЛЬКО через /api/news/resolve/<slug>/ (без /article|/rss|/news/...)
//   ✅ «Похожие» тянем напрямую GET /api/category/<category-slug>/?page=1 (если категория есть)
//   ✅ «Последние новости» слева — через fetchNews(1)
//   ✅ Метрики: безопасный прямой POST на /api/news/metrics/hit/ с { slug, path, ref }
//   ✅ Хлебные крошки: Главная › <Категория (кликабельна)>
//   ✅ SVG-плейсхолдер для обложки (не тянем /media)
//   ✅ Никаких импортов fetchRelatedByCategory и т. п. — только api и fetchNews
//
// Что удалено ради возврата к прежнему состоянию:
//   ❌ Импорт fetchRelatedByCategory (раньше его не было) — убран.

import React, { useEffect, useState, useRef } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import DOMPurify from "dompurify";

import api, { fetchNews } from "../Api"; // axios-инстанс + лента
import SmartMedia from "../components/SmartMedia";
import s from "./NewsDetailPage.module.css";

// Встроенный плейсхолдер (не зависит от /media)
const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#0a0f1a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#5a6b84" font-family="Arial" font-size="18">Нет изображения</text></svg>'
  );

// ——— Утилиты ———
function sanitize(html) {
  if (!html) return "";
  return DOMPurify.sanitize(String(html), {
    USE_PROFILES: { html: true },
    ALLOWED_ATTR: ["href", "title", "alt", "src", "target", "rel"],
  });
}

function normalizeResolverPayload(data, fallbackSlug) {
  const item =
    data?.item ||
    data?.article ||
    data?.imported ||
    (data?.result && (data.result.article || data.result.imported)) ||
    data?.data ||
    data;

  const category =
    item?.category ||
    data?.category ||
    (typeof data?.category_slug === "string"
      ? {
          slug: data.category_slug,
          name:
            data.category_name || data.category_ru || data.category || data.category_slug,
        }
      : null);

  const categoryName =
    category?.name ||
    data?.category_name ||
    item?.category_name ||
    item?.category_ru ||
    category?.slug ||
    "Категория";

  const slug =
    item?.slug ||
    data?.slug ||
    data?.canonical_slug ||
    (typeof data?.seo_url === "string"
      ? data.seo_url.split("/").filter(Boolean).pop()
      : null) ||
    fallbackSlug;

  const seo_url = item?.seo_url || data?.seo_url || null;

  const image =
    item?.image ||
    item?.image_url ||
    item?.cover_image ||
    item?.preview_image ||
    item?.thumbnail ||
    null;

  return {
    item: { ...item, slug, image },
    category: category ? { slug: category.slug || category, name: categoryName } : null,
    categoryName,
    seo_url,
    slug,
  };
}

async function hitMetricsSafe(slug, path, ref) {
  if (!slug) return;
  try {
    await api.post("/news/metrics/hit/", {
      slug,
      path,
      ref,
      ts: Date.now(),
    });
  } catch {
    // не блокируем UI
  }
}

// ——— Компонент ———
export default function NewsDetailPage() {
  // Ожидаемые пути: /:category/:slug/ или /news/:slug/
  const params = useParams();
  const location = useLocation();

  const slugFromUrl = params.slug || params.news || params.article || null;
  const categoryFromUrl =
    params.category || params.cat || params.categorySlug || params.section || null;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [article, setArticle] = useState(null);
  const [category, setCategory] = useState(null); // {slug, name}
  const [related, setRelated] = useState([]);
  const [latest, setLatest] = useState([]);

  const onceMetrics = useRef(false);

  // 1) Загружаем деталь через /api/news/resolve/<slug>/
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);

      const slug = slugFromUrl;
      if (!slug) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        const res = await api.get(`/news/resolve/${encodeURIComponent(slug)}/`);
        const { item, category: cat, categoryName } = normalizeResolverPayload(res.data, slug);

        if (!item || !item.title) {
          if (!cancelled) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setArticle(item);
          setCategory(cat || (categoryFromUrl ? { slug: categoryFromUrl, name: categoryName } : null));
          setNotFound(false);
          setLoading(false);
        }

        // Метрики — только один раз
        if (!onceMetrics.current) {
          onceMetrics.current = true;
          hitMetricsSafe(item.slug, location.pathname, document.referrer || "");
        }

        // Похожие — если знаем категорию
        if (cat?.slug) {
          try {
            const relRes = await api.get(`/category/${encodeURIComponent(cat.slug)}/`, {
              params: { page: 1 },
            });
            const relList = Array.isArray(relRes.data?.results)
              ? relRes.data.results
              : Array.isArray(relRes.data)
              ? relRes.data
              : [];

            const cleaned = relList.filter(
              (n) => (n.slug || n.id) !== (item.slug || item.id)
            );
            if (!cancelled) setRelated(cleaned.slice(0, 10));
          } catch {
            if (!cancelled) setRelated([]);
          }
        } else {
          if (!cancelled) setRelated([]);
        }
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
          setArticle(null);
          setRelated([]);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugFromUrl]);

  // 2) Левый блок — последние новости
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchNews(1);
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : [];
        if (!cancelled) setLatest(list.slice(0, 30));
      } catch {
        if (!cancelled) setLatest([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ——— Рендер ———

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.columns}>
          <aside className={s.side}>
            <div className={s.card}>
              <div className={s.cardTitle}>Последние новости</div>
              <div className={s.scrollBox}>
                <div className={s.muted}>Загрузка…</div>
              </div>
            </div>
          </aside>

          <main className={s.main}>
            <div className={s.card}>
              <h1 className={s.title}>Загрузка…</h1>
              <div className={s.breadcrumbs}>
                <Link to="/">Главная</Link>
                {categoryFromUrl && <span> › {categoryFromUrl}</span>}
              </div>
              <div className={s.text}>Пожалуйста, подождите…</div>
            </div>
          </main>

          <aside className={s.side}>
            <div className={s.card} />
          </aside>
        </div>
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className={s.page}>
        <div className={s.columns}>
          <aside className={s.side}>
            <div className={s.card}>
              <div className={s.cardTitle}>Последние новости</div>
              <div className={s.scrollBox}>
                {latest.map((n, i) => {
                  const to =
                    n.seo_url ||
                    (n.category?.slug && n.slug
                      ? `/${n.category.slug}/${n.slug}/`
                      : n.slug
                      ? `/news/${n.slug}/`
                      : "#");
                  return (
                    <Link key={`${n.id || n.slug || i}`} to={to} className={s.linkLine}>
                      {n.title || "Без заголовка"}
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>

          <main className={s.main}>
            <div className={s.card}>
              <h1 className={s.title}>Новость не найдена</h1>
              <div className={s.breadcrumbs}>
                <Link to="/">Главная</Link>
                {categoryFromUrl && (
                  <>
                    <span> › </span>
                    <Link to={`/${categoryFromUrl}/`}>{categoryFromUrl}</Link>
                  </>
                )}
              </div>
              <div className={s.text}>
                Возможно, ссылка устарела или была изменена. Попробуйте вернуться на{" "}
                <Link to="/">главную</Link>.
              </div>
            </div>
          </main>

          <aside className={s.side}>
            <div className={s.card} />
          </aside>
        </div>
      </div>
    );
  }

  const safeTitle = article?.title || "Без заголовка";
  const safeHtml = sanitize(article?.text || article?.content || article?.body || article?.summary);
  const cat = category?.slug || categoryFromUrl || "news";
  const catName = category?.name || "Категория";

  return (
    <div className={s.page}>
      <div className={s.columns}>
        {/* Левый блок — последние */}
        <aside className={s.side}>
          <div className={s.card}>
            <div className={s.cardTitle}>Последние новости</div>
            <div className={s.scrollBox}>
              {latest.map((n, i) => {
                const to =
                  n.seo_url ||
                  (n.category?.slug && n.slug
                    ? `/${n.category.slug}/${n.slug}/`
                    : n.slug
                    ? `/news/${n.slug}/`
                    : "#");
                return (
                  <Link key={`${n.id || n.slug || i}`} to={to} className={s.linkLine}>
                    {n.title || "Без заголовка"}
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Центр — основная новость */}
        <main className={s.main}>
          <div className={s.card}>
            <h1 className={s.title}>{safeTitle}</h1>

            <div className={s.breadcrumbs}>
              <Link to="/">Главная</Link>
              <span> › </span>
              <Link to={`/${cat}/`}>{catName}</Link>
            </div>

            <div className={s.cover}>
              <SmartMedia
                src={article?.image}
                alt={safeTitle}
                placeholder={PLACEHOLDER}
                title={null}
                aspect="auto"
                className={s.coverImg}
              />
            </div>

            <div
              className={s.text}
              dangerouslySetInnerHTML={{ __html: safeHtml || "<p>Текст не указан.</p>" }}
            />
          </div>
        </main>

        {/* Правый блок — похожие по категории */}
        <aside className={s.side}>
          <div className={s.card}>
            <div className={s.cardTitle}>Похожие</div>
            <div className={s.scrollBox}>
              {related.length === 0 && <div className={s.muted}>Нет похожих материалов</div>}
              {related.map((n, i) => {
                const to =
                  n.seo_url ||
                  (n.category?.slug && n.slug
                    ? `/${n.category.slug}/${n.slug}/`
                    : n.slug
                    ? `/news/${n.slug}/`
                    : "#");
                return (
                  <Link key={`${n.id || n.slug || i}`} to={to} className={s.linkLine}>
                    {n.title || "Без заголовка"}
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
