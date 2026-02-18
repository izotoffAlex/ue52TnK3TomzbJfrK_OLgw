/* Путь: frontend/src/pages/CategoriesPage.js
   Назначение: Страница-список всех категорий (/categories). Ссылки ведут на короткие пути "/{slug}/".
   FIX v2025-12-25:
   ✅ H1 "Категории" скрыт ВИЗУАЛЬНО, но остаётся в DOM для SEO/доступности (visually hidden, не display:none).
   ✅ Подписи на карточках категорий всегда белые (не ломаются глобальными правилами светлой темы).
   ✅ Добавлены SEO-теги через react-helmet-async (title/description/canonical/OG).
*/

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import s from "./CategoriesPage.module.css";

import {
  fetchCategories,
  fetchCategoryCovers, // батч обложек /api/categories/covers/
  buildThumbnailUrl, // ресайзер (безопасно обрабатывает только http/https)
} from "../Api";

import SmartMedia from "../components/SmartMedia";
import SmartTitle from "../components/SmartTitle";

/** Visually hidden: не показываем, но оставляем в DOM для SEO/скринридеров */
const VISUALLY_HIDDEN = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

/** Белая подпись поверх картинки (перебивает глобальные стили ссылок в светлой теме) */
const CARD_CAPTION_TEXT = {
  color: "#ffffff",
  WebkitTextFillColor: "#ffffff",
  textShadow: "0 2px 10px rgba(0,0,0,0.80)",
  fontWeight: 800,
};

export default function CategoriesPage() {
  const [cats, setCats] = useState([]);
  const [covers, setCovers] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingCovers, setLoadingCovers] = useState(true);
  const [error, setError] = useState("");

  // 1) Загружаем список категорий
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    fetchCategories()
      .then((res) => {
        const data = res?.data || res;
        const list = Array.isArray(data) ? data : data?.results || [];
        if (!cancelled) setCats(list);
      })
      .catch(() => !cancelled && setError("Не удалось загрузить категории"))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Батч-обложки для всех категорий (быстро)
  useEffect(() => {
    let cancelled = false;

    if (!cats.length) {
      setCovers({});
      setLoadingCovers(false);
      return;
    }

    setLoadingCovers(true);
    const slugs = cats.map((c) => c.slug || c.seo_slug || c.url_slug).filter(Boolean);

    fetchCategoryCovers(slugs)
      .then((res) => {
        // ожидаем словарь вида { "<slug>": "https://..." }
        const mapping = res?.data || res || {};
        if (!cancelled) setCovers(mapping || {});
      })
      .catch(() => !cancelled && setCovers({}))
      .finally(() => !cancelled && setLoadingCovers(false));

    return () => {
      cancelled = true;
    };
  }, [cats]);

  const items = useMemo(() => {
    return cats.map((c) => {
      const slug = c.slug || c.seo_slug || c.url_slug || "";
      const name = c.name || c.title || slug;
      const cover = covers[slug] || c.cover || c.image || c.thumb || null;

      // прогоняем через ресайзер ТОЛЬКО http/https
      const safeCover = cover
        ? buildThumbnailUrl(cover, { w: 1200, h: 630, fit: "cover" })
        : null;

      return { slug, name, cover: safeCover, count: c.count || c.articles_count || null };
    });
  }, [cats, covers]);

  const SEO_TITLE = "Категории — IzotovLife";
  const SEO_DESC =
    "Все рубрики IzotovLife: политика, экономика, общество, технологии, спорт, культура и другие темы. Удобная навигация по новостям из разных источников.";
  const CANONICAL = "https://izotovlife.ru/categories";

  if (loading) {
    return (
      <div className={s.page}>
        <Helmet>
          <title>{SEO_TITLE}</title>
          <meta name="description" content={SEO_DESC} />
          <link rel="canonical" href={CANONICAL} />
          <meta property="og:title" content={SEO_TITLE} />
          <meta property="og:description" content={SEO_DESC} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={CANONICAL} />
        </Helmet>

        {/* H1 для SEO, но не показываем */}
        <h1 className={s.title} style={VISUALLY_HIDDEN}>
          <SmartTitle>Категории</SmartTitle>
        </h1>

        <div className={s.grid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={`${s.card} ${s.skeleton}`} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.page}>
        <Helmet>
          <title>{SEO_TITLE}</title>
          <meta name="description" content={SEO_DESC} />
          <link rel="canonical" href={CANONICAL} />
          <meta property="og:title" content={SEO_TITLE} />
          <meta property="og:description" content={SEO_DESC} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={CANONICAL} />
        </Helmet>

        {/* H1 для SEO, но не показываем */}
        <h1 className={s.title} style={VISUALLY_HIDDEN}>
          <SmartTitle>Категории</SmartTitle>
        </h1>

        <p className={s.error}>{error}</p>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <Helmet>
        <title>{SEO_TITLE}</title>
        <meta name="description" content={SEO_DESC} />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content={SEO_TITLE} />
        <meta property="og:description" content={SEO_DESC} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={CANONICAL} />
      </Helmet>

      {/* H1 для SEO, но не показываем */}
      <h1 className={s.title} style={VISUALLY_HIDDEN}>
        <SmartTitle>Категории</SmartTitle>
      </h1>

      <div className={s.grid}>
        {items.map((it) => (
          <article key={it.slug} className={s.card}>
            {/* Короткий путь верхнего уровня */}
            <Link to={`/${it.slug}/`} className={s.cardLink} aria-label={`Категория: ${it.name}`}>
              <div className={s.cardMedia}>
                {it.cover ? <SmartMedia src={it.cover} alt={it.name} /> : <div className={s.placeholder} />}

                <div className={s.overlay} />

                <div className={s.caption}>
                  <span className={s.name} style={CARD_CAPTION_TEXT}>
                    {it.name}
                  </span>

                  {typeof it.count === "number" && (
                    <span className={s.count} style={CARD_CAPTION_TEXT}>
                      {it.count}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </article>
        ))}
      </div>

      {/* Покажем мягко состояние подзагрузки обложек, чтобы не дёргать сетку */}
      {loadingCovers && <div className={s.note}>Загружаем обложки…</div>}
    </div>
  );
}
