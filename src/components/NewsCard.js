// Путь: frontend/src/components/NewsCard.js
// Назначение: Карточка новости для ленты (в стиле Дзена, SEO-ready).
// Обновления:
// ✅ Никогда не показываем `//`: разбиваем заголовок на части и рендерим построчно без слэшей
// ✅ alt/aria-label — уже без `//` (через titleForAttr)
// ✅ Остальной функционал (короткие ссылки, preconnect, eager и т. п.) сохранён

import React, { useMemo, useRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import s from "./NewsCard.module.css";
import SourceBadge from "./SourceBadge";
import OptimizedCardImage from "./OptimizedCardImage";
import { thumbUrl } from "../utils/thumb";
import { getTitlePartsFromItem, titleForAttr } from "../utils/title";

function hostName(url) {
  try {
    const u = new URL(url);
    let h = u.hostname || "";
    h = h.replace(/^www\./i, "").replace(/^m\./i, "").replace(/^amp\./i, "");
    const parts = h.split(".");
    if (parts.length > 2) return parts.slice(-2).join(".");
    return h || null;
  } catch {
    return null;
  }
}

function resolveSource(item) {
  const sourceObj =
    item.source || item.news_source || item.source_fk || item.publisher_obj || null;

  const sourceUrl =
    sourceObj?.site_url ||
    sourceObj?.url ||
    sourceObj?.link ||
    item.source_url ||
    item.site_url ||
    item.link_source ||
    item.original_link ||
    item.original_url ||
    item.link ||
    item.url ||
    null;

  const sourceNameRaw =
    item.source_name ||
    item.source_title ||
    item.publisher ||
    item.sourceDomain ||
    sourceObj?.name ||
    sourceObj?.title ||
    null;

  let sourceName = null;
  if (sourceNameRaw && sourceNameRaw.toLowerCase() !== "rss") {
    sourceName = sourceNameRaw;
  } else {
    sourceName = hostName(sourceUrl) || "Источник";
  }

  return {
    name: sourceName,
    site_url: sourceUrl,
    logo: item.source_logo || sourceObj?.logo || sourceObj?.image || sourceObj?.icon || null,
  };
}

/** Нормализует относительный путь: +ведущий слэш, −двойные, +закрывающий */
function normalizeAppPath(p) {
  if (!p) return "/";
  let out = String(p).trim();
  if (/^https?:\/\//i.test(out)) return out; // абсолютные — не трогаем
  if (!out.startsWith("/")) out = `/${out}`;
  out = out.replace(/\/{2,}/g, "/");
  if (!out.endsWith("/")) out = `${out}/`;
  return out;
}

function useNormalized(item) {
  return useMemo(() => {
    const id = item.id ?? item.pk ?? item._id ?? null;

    const titleParts = getTitlePartsFromItem(item); // ← тут режем `//`
    const titleAttr = titleForAttr(item?.title || "Без названия");

    const rawSlug =
      item.slug || item.seo_slug || item.url_slug || item.seourl || item.slugified || null;
    const slug = rawSlug ? encodeURIComponent(String(rawSlug)) : null;

    const rawCatSlug =
      item.category_slug ||
      item.category?.slug ||
      item.category?.seo_slug ||
      item.categories?.[0]?.slug ||
      null;
    const categorySlug = rawCatSlug ? encodeURIComponent(String(rawCatSlug)) : null;

    let detailTo = "#";
    if (item.seo_url) {
      detailTo = normalizeAppPath(item.seo_url);
    } else if (categorySlug && slug) {
      detailTo = normalizeAppPath(`/${categorySlug}/${slug}`);
    } else if (slug) {
      detailTo = normalizeAppPath(`/news/${slug}`);
    } else if (id) {
      detailTo = normalizeAppPath(`/news/${id}`);
    }

    const cover = item.cover_image || item.image_url || item.image || item.thumbnail || null;
    const source = resolveSource(item);
    const date = item.published_at || item.pub_date || item.created_at || item.date || null;
    const categoryName = item.category_name || item.category?.name || null;

    return { id, titleParts, titleAttr, detailTo, cover, source, date, categoryName, categorySlug };
  }, [item]);
}

export default function NewsCard({ item, badgeAlign = "right" }) {
  const { titleParts, titleAttr, detailTo, cover, source, date, categoryName, categorySlug } =
    useNormalized(item);

  const dateStr = useMemo(() => {
    if (!date) return null;
    try {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleDateString("ru-RU", { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      return null;
    }
  }, [date]);

  const hasCover = Boolean(cover);

  const ref = useRef(null);
  const [eagerLocal, setEagerLocal] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add(s.visible);
          io.disconnect();
        }
      },
      { root: null, rootMargin: "300px 0px 300px 0px", threshold: 0 }
    );
    io.observe(el);

    try {
      const rect = el.getBoundingClientRect();
      const inInitial = rect.top < window.innerHeight * 1.5;
      if (inInitial) {
        setEagerLocal(true);

        if (hasCover) {
          const w = 480;
          const h = Math.round((w * 9) / 16);
          const url = thumbUrl(cover, { w, h });
          const u = new URL(url);
          const linkId = `preconnect-${u.host}`;
          if (!document.getElementById(linkId)) {
            const link = document.createElement("link");
            link.id = linkId;
            link.rel = "preconnect";
            link.href = `${u.protocol}//${u.host}`;
            link.crossOrigin = "";
            document.head.appendChild(link);
          }
          const img = new Image();
          img.decoding = "async";
          img.loading = "eager";
          img.src = url;
        }
      }
    } catch {}

    return () => {
      io.disconnect();
    };
  }, [hasCover, cover]);

  return (
    <article ref={ref} className={`${s.card} news-card`}>
      <Link to={detailTo} className={s.mediaWrap} aria-label={titleAttr}>
        <OptimizedCardImage
          className={s.media}
          src={hasCover ? cover : null}
          alt={titleAttr}
          aspectW={16}
          aspectH={9}
          eager={eagerLocal}
          hideOnError
        />
        {hasCover ? (
          <SourceBadge
            source={source}
            href={source.site_url || undefined}
            align={badgeAlign}
            insideLink
          />
        ) : null}
      </Link>

      <div className={s.body}>
        <h3 className={s.title}>
          <Link to={detailTo}>
            {/* Каждую часть — с новой строки, без `//` */}
            {titleParts.map((part, idx) => (
              <React.Fragment key={idx}>
                {part}
                {idx < titleParts.length - 1 && <br />}
              </React.Fragment>
            ))}
          </Link>
        </h3>

        {!hasCover ? (
          <div className={s.sourceLine}>
            <span className={s.sourceDot} />
            <span className={s.sourceText}>{source.name}</span>
          </div>
        ) : null}

        <div className={s.meta}>
          {categoryName ? (
            categorySlug ? (
              <Link className={s.cat} to={normalizeAppPath(`/${decodeURIComponent(categorySlug)}`)}>
                {categoryName}
              </Link>
            ) : (
              <span className={s.cat}>{categoryName}</span>
            )
          ) : null}
          {dateStr ? <time className={s.date}>{dateStr}</time> : null}
        </div>
      </div>
    </article>
  );
}
