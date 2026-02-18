// Путь: frontend/src/components/NewsCard.js
// Назначение: Карточка новости для ленты (главная/категории).
//
// FIX (2026-02-17 CARD SIZE):
// - Добавлен проп size ("normal" | "large").
// - Для size="large" используется модификатор .cardLarge (более высокая карточка).
// - Используется общий CSS NewsCard.module.css.
//
// FIX (2026-02-18 META ALIGN INSIDE):
// - Внутри .body добавлен flex-контейнер .content для текста.
// - .meta всегда последний блок и прижимается к низу через CSS.

import React, {
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
} from "react";
import { Link } from "react-router-dom";
import s from "./NewsCard.module.css";
import SourceBadge from "./SourceBadge";
import { isAudioUrl, buildThumbnailUrl } from "../Api";
import { getTitlePartsFromItem, titleForAttr } from "../utils/title";

/* =========================
   Хелперы категории/источника
   ========================= */

const CAT_DISPLAY_NAMES = {
  rossiya: "Россия",
  russia: "Россия",
  rf: "Россия",
  obshchestvo: "Общество",
  obschestvo: "Общество",
  ekonomika: "Экономика",
  politika: "Политика",
  mir: "Мир",
  sport: "Спорт",
  kultura: "Культура",
  proisshestviya: "Происшествия",
  tehnologii: "Технологии",
  tekhnologii: "Технологии",
  nauka: "Наука",
  avto: "Авто",
  zdorovye: "Здоровье",
  zdravookhranenie: "Здоровье",
};

function looksLikeSlug(text) {
  const s0 = String(text || "").trim();
  if (!s0) return false;
  if (/[А-Яа-яЁё]/.test(s0)) return false;
  return /^[a-z0-9-]+$/i.test(s0);
}

function humanizeSlug(slug) {
  const s0 = String(slug || "").trim();
  if (!s0) return "";
  return s0
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function prettifyCategoryName(categorySlugDecoded, categoryNameRaw) {
  const name = String(categoryNameRaw || "").trim();
  const slug = String(categorySlugDecoded || "").trim();

  if (name && !looksLikeSlug(name)) return name;
  if (slug && CAT_DISPLAY_NAMES[slug]) return CAT_DISPLAY_NAMES[slug];
  if (slug) return humanizeSlug(slug);
  return name || null;
}

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
    item.source ||
    item.news_source ||
    item.source_fk ||
    item.publisher_obj ||
    null;

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
  if (sourceNameRaw && String(sourceNameRaw).toLowerCase() !== "rss") {
    sourceName = sourceNameRaw;
  } else {
    sourceName = hostName(sourceUrl) || "Источник";
  }

  return {
    name: sourceName,
    site_url: sourceUrl,
    logo:
      item.source_logo ||
      sourceObj?.logo ||
      sourceObj?.image ||
      sourceObj?.icon ||
      null,
  };
}

function normalizeAppPath(p) {
  if (!p) return "/";
  let out = String(p).trim();
  if (/^https?:\/\//i.test(out)) return out;
  if (!out.startsWith("/")) out = `/${out}`;
  out = out.replace(/\/{2,}/g, "/");
  if (!out.endsWith("/")) out = `${out}/`;
  return out;
}

function useNormalized(item) {
  return useMemo(() => {
    const id = item.id ?? item.pk ?? item._id ?? null;

    const titleParts = getTitlePartsFromItem(item);
    const titleAttr = titleForAttr(item?.title || "Без названия");

    const rawSlug =
      item.slug ||
      item.seo_slug ||
      item.url_slug ||
      item.seourl ||
      item.slugified ||
      null;
    const slug = rawSlug ? encodeURIComponent(String(rawSlug)) : null;

    const rawCatSlug =
      item.category_slug ||
      item.category?.slug ||
      item.category?.seo_slug ||
      item.categories?.[0]?.slug ||
      null;
    const categorySlug = rawCatSlug
      ? encodeURIComponent(String(rawCatSlug))
      : null;

    let detailTo = "#";

    if (item.seo_url) {
      detailTo = normalizeAppPath(item.seo_url);
    } else if (categorySlug && slug) {
      detailTo = normalizeAppPath(`/${categorySlug}/${slug}`);
    } else {
      detailTo = "#";
    }

    const cover =
      item.cover_image || item.image_url || item.image || item.thumbnail || null;

    const source = resolveSource(item);
    const date =
      item.published_at ||
      item.pub_date ||
      item.created_at ||
      item.date ||
      null;
    const categoryName = item.category_name || item.category?.name || null;

    return {
      id,
      titleParts,
      titleAttr,
      detailTo,
      cover,
      source,
      date,
      categoryName,
      categorySlug,
    };
  }, [item]);
}

export default function NewsCard({
  item,
  badgeAlign = "right",
  size = "normal", // "normal" | "large"
}) {
  const {
    titleParts,
    titleAttr,
    detailTo,
    cover,
    source,
    date,
    categoryName,
    categorySlug,
  } = useNormalized(item);

  const authorUsername = String(
    item?.author_username ||
      item?.author_login ||
      item?.author_slug ||
      item?.author?.username ||
      item?.author?.login ||
      item?.author?.slug ||
      ""
  ).trim();

  const authorTitleRaw = String(
    item?.author_display ||
      item?.author_name ||
      item?.author_full_name ||
      item?.author?.display ||
      item?.author?.name ||
      item?.author?.full_name ||
      authorUsername ||
      ""
  ).trim();

  const authorTitle = authorTitleRaw || authorUsername;
  const authorHref = authorUsername
    ? `/author/${encodeURIComponent(authorUsername)}/`
    : "";

  const dateStr = useMemo(() => {
    if (!date) return null;
    try {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
    } catch {
      return null;
    }
  }, [date]);

  const hasCover = Boolean(cover);
  const isAudioCover = hasCover && isAudioUrl(cover);

  const thumbUrl = useMemo(() => {
    if (!hasCover || isAudioCover) return null;
    try {
      const w = 480;
      const h = Math.round((w * 9) / 16);
      return (
        buildThumbnailUrl(cover, { w, h, q: 82, fmt: "webp", fit: "cover" }) ||
        null
      );
    } catch {
      return null;
    }
  }, [hasCover, isAudioCover, cover]);

  const attemptRef = useRef(0);
  const [imgSrc, setImgSrc] = useState(null);

  useEffect(() => {
    attemptRef.current = 0;

    if (!hasCover || isAudioCover) {
      setImgSrc(null);
      attemptRef.current = 2;
      return;
    }

    setImgSrc(thumbUrl || cover);
  }, [hasCover, isAudioCover, thumbUrl, cover]);

  const onImgError = useCallback(() => {
    const step = attemptRef.current;

    if (step === 0) {
      attemptRef.current = 1;
      if (cover) {
        setImgSrc(cover);
        return;
      }
    }

    attemptRef.current = 2;
    setImgSrc(null);
  }, [cover]);

  const hasVisualMedia = Boolean(imgSrc);

  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.classList.add(s.visible);
        io.disconnect();
      }
    });

    io.observe(el);
    return () => io.disconnect();
  }, []);

  const categorySlugDecoded = categorySlug ? decodeURIComponent(categorySlug) : "";
  const categoryDisplayName = prettifyCategoryName(
    categorySlugDecoded,
    categoryName
  );

  const cardClassName =
    size === "large"
      ? `${s.card} ${s.cardLarge} news-card`
      : `${s.card} news-card`;

  return (
    <article ref={ref} className={cardClassName}>
      <Link
        to={detailTo}
        className={`${s.mediaWrap} mediaWrap`}
        aria-label={titleAttr}
      >
        {hasVisualMedia ? (
          <img
            className={`${s.media} media`}
            src={imgSrc}
            alt={titleAttr}
            loading="lazy"
            decoding="async"
            onError={onImgError}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}

        <SourceBadge
          source={source}
          href={source.site_url || undefined}
          align={badgeAlign}
          insideLink
        />
      </Link>

      <div className={`${s.body} body`}>
        <div className={s.content}>
          <h3 className={`${s.title} title`}>
            <Link to={detailTo}>
              {titleParts.map((part, idx) => (
                <React.Fragment key={idx}>
                  {part}
                  {idx < titleParts.length - 1 && <br />}
                </React.Fragment>
              ))}
            </Link>
          </h3>

          {authorHref ? (
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
              Автор:{" "}
              <Link
                to={authorHref}
                style={{ color: "var(--accent, #fbbf24)" }}
              >
                {authorTitle}
              </Link>
            </div>
          ) : null}

          {!hasVisualMedia ? (
            <div className={s.sourceLine}>
              <span className={s.sourceDot} />
              <span className={s.sourceText}>{source.name}</span>
            </div>
          ) : null}
        </div>

        <div className={s.meta}>
          {categoryDisplayName ? (
            categorySlug ? (
              <Link
                className={s.cat}
                to={normalizeAppPath(`/${categorySlugDecoded}`)}
              >
                {categoryDisplayName}
              </Link>
            ) : (
              <span className={s.cat}>{categoryDisplayName}</span>
            )
          ) : null}
          {dateStr ? <time className={s.date}>{dateStr}</time> : null}
        </div>
      </div>
    </article>
  );
}
