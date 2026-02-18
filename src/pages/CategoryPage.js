// Путь: frontend/src/pages/CategoryPage.js
// Назначение: Категории и лента категории в “портальном” стиле (смешанные блоки: фото + текст).
//
// FIX (2026-02-15-AUTHOR-FORCED-SLUG + 2026-02-15-AUTHOR-SIMPLE-VIEW-V4):
// ✅ forcedSlug для /avtorskie-materialy/.
// ✅ Для avtorskie-materialy: упрощённый режим (простой список).
// ✅ В авторской категории показываем ТОЛЬКО авторские статьи (type === "article").
// ✅ Убран лишний «Загрузка…» внизу, аккуратные карточки: жирный заголовок + краткое описание.
// ✅ Исправлен key в портальном режиме, убран вложенный template literal.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import InfiniteScroll from "react-infinite-scroll-component";
import { Helmet } from "react-helmet-async";

import s from "./CategoryPage.module.css";

import {
  fetchCategories,
  fetchCategoryCovers,
  fetchCategoryNews,
  isAudioUrl,
} from "../Api";

import NewsCard from "../components/NewsCard";
import SourceLabel from "../components/SourceLabel";
import IncomingNewsTray from "../components/IncomingNewsTray";

const COVERS_CACHE_KEY = "cat_covers_v1";
const COVERS_TTL_MS = 10 * 60 * 1000;

const NEWSLETTER_SUBSCRIBED_KEY = "il_newsletter_subscribed_v1";
const NEWSLETTER_DISMISSED_AT_KEY = "il_newsletter_dismissed_at_v1";
const NEWSLETTER_DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const NEWSLETTER_DELAY_MIN_MS = 5000;
const NEWSLETTER_DELAY_MAX_MS = 10000;

// localStorage helpers
function lsGetBool(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function lsSetBool(key, val) {
  try {
    localStorage.setItem(key, val ? "1" : "0");
  } catch {}
}
function lsGetInt(key) {
  try {
    const v = Number(localStorage.getItem(key) || 0);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}
function lsSetInt(key, val) {
  try {
    localStorage.setItem(key, String(Number(val) || 0));
  } catch {}
}
function isNewsletterDismissedNow() {
  const dismissedAt = lsGetInt(NEWSLETTER_DISMISSED_AT_KEY);
  if (!dismissedAt) return false;
  return Date.now() - dismissedAt < NEWSLETTER_DISMISS_TTL_MS;
}
function isNewsletterSubscribedNow() {
  return lsGetBool(NEWSLETTER_SUBSCRIBED_KEY);
}

// visually hidden util
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

const CAT_LABEL_STYLE = {
  color: "#fff",
  textShadow: "0 2px 8px rgba(0,0,0,0.55)",
};

const CAT_DISPLAY_NAMES = {
  svo: "СВО",
  proisshestviya: "Происшествия",
  politika: "Политика",
  mir: "Мир",
  ekonomika: "Экономика и бизнес",
  sport: "Спорт",
  "novosti-regionov": "Новости регионов",
  pravo: "Право",
  "avtorskie-materialy": "Авторские материалы",
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

function isImageOk(src) {
  if (!src) return false;
  const s0 = String(src).trim();
  if (!s0) return false;
  return (
    /^https?:\/\//i.test(s0) ||
    s0.startsWith("/media/") ||
    s0.startsWith("/static/")
  );
}

function imageFromItem(n) {
  return (
    n?.cover_image ||
    n?.image_url ||
    n?.image ||
    n?.thumbnail ||
    n?.photo ||
    ""
  );
}

function isAuthorMaterialsCategorySlug(slug) {
  return String(slug || "").toLowerCase().trim() === "avtorskie-materialy";
}

function buildNewsUrl(n, fallbackCategorySlug) {
  if (n?.seo_url) return n.seo_url;
  const cat = n?.category?.slug || fallbackCategorySlug || "";
  const slug = n?.slug || "";
  if (!cat || !slug) return "/";
  return `/${cat}/${slug}/`;
}

function pickAudioFlag(n) {
  const candidate =
    n?.audio_url || n?.audio || n?.media_url || n?.url || "";
  try {
    return isAudioUrl(candidate);
  } catch {
    return false;
  }
}

// Фильтр «это авторская статья» по полю type
function isAuthorArticleItem(n) {
  const t = String(n?.type || "").toLowerCase().trim();
  return t === "article";
}

export default function CategoryPage({ forcedSlug } = {}) {
  const params = useParams();
  const location = useLocation();

  // forcedSlug для /avtorskie-materialy/
  const slug = String(forcedSlug || params?.slug || "").trim();

  const isListMode =
    !slug ||
    location.pathname === "/categories" ||
    location.pathname.startsWith("/categories/");

  const apiSlug = slug;
  const isAuthorMaterialsCategory = isAuthorMaterialsCategorySlug(apiSlug);

  console.log("CATEGORY PAGE MOUNTED", {
    slug,
    apiSlug,
    path: location.pathname,
    isAuthorMaterialsCategory,
  });

  const [allCategories, setAllCategories] = useState([]);
  const [covers, setCovers] = useState({});
  const coversRef = useRef(covers);
  useEffect(() => {
    coversRef.current = covers;
  }, [covers]);
  const [catsLoading, setCatsLoading] = useState(true);

  const [photoNews, setPhotoNews] = useState([]);
  const [textNews, setTextNews] = useState([]);

  // отдельное хранилище для авторских материалов (упрощённый режим)
  const [authorItems, setAuthorItems] = useState([]);

  const [categoryName, setCategoryName] = useState(slug || "Категории");
  const [, setLoading] = useState(true);

  const pageRef = useRef(1);
  const loadingRef = useRef(false);

  const [hasMore, setHasMore] = useState(true);
  const hasMoreRef = useRef(true);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const blocksRef = useRef(null);
  const [prefilled, setPrefilled] = useState(false);

  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const subscribeTimerRef = useRef(0);

  const [emptyMessage, setEmptyMessage] = useState("");

  const hasSomeText = useCallback((n) => {
    if (!n) return false;
    const clean = (htmlOrText) => {
      const tmp = document.createElement("div");
      tmp.innerHTML = htmlOrText || "";
      let plain = (tmp.textContent || tmp.innerText || "").toLowerCase();
      plain = plain
        .replace(/\u00a0|\u202f/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^[.,!?:;\-—–\s]+|[.,!?:;\-—–\s]+$/g, "");
      return plain;
    };
    const title = clean(n.title || "");
    const body = clean(
      n.summary ||
        n.description ||
        n.text ||
        n.body ||
        n.content ||
        n.content_html ||
        n.lead ||
        n.short_text ||
        ""
    );
    const isStop = (s) =>
      !s ||
      s === "без текста" ||
      s === "нет текста" ||
      s === "no text" ||
      s === "notext" ||
      s === "n/a" ||
      s === "-" ||
      s === "—" ||
      s === "–";
    const MIN_LEN = 8;
    const okTitle = !!title && !isStop(title);
    const okBody = !!body && !isStop(body) && body.length >= MIN_LEN;
    return okTitle || okBody;
  }, []);

  // categories + covers
  useEffect(() => {
    let mounted = true;

    async function loadCatsAndCovers() {
      setCatsLoading(true);
      try {
        const cats = await fetchCategories();
        const list = Array.isArray(cats) ? cats : [];
        if (!mounted) return;
        setAllCategories(list);

        const cached = (function readCoversCache() {
          try {
            const raw = localStorage.getItem(COVERS_CACHE_KEY);
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (!obj || typeof obj !== "object") return null;
            if (!obj.ts || !obj.data) return null;
            if (Date.now() - obj.ts > COVERS_TTL_MS) return null;
            return obj.data;
          } catch {
            return null;
          }
        })();

        if (cached && typeof cached === "object") {
          setCovers(cached);
        } else {
          const cov = await fetchCategoryCovers();
          if (!mounted) return;
          if (cov && typeof cov === "object") {
            setCovers(cov);
            try {
              localStorage.setItem(
                COVERS_CACHE_KEY,
                JSON.stringify({ ts: Date.now(), data: cov })
              );
            } catch {}
          }
        }
      } catch {
        if (mounted) setAllCategories([]);
      } finally {
        if (mounted) setCatsLoading(false);
      }
    }

    loadCatsAndCovers();
    return () => {
      mounted = false;
    };
  }, []);

  // category name
  useEffect(() => {
    let mounted = true;

    async function loadCategoryName() {
      try {
        const cats = await fetchCategories();
        const list = Array.isArray(cats) ? cats : [];
        const found =
          list.find((c) => c.slug === apiSlug) || list.find((c) => c.slug === slug);
        const apiName = found?.name || found?.title || "";
        if (mounted)
          setCategoryName(apiName || (slug || "Категории"));
      } catch {
        if (mounted) setCategoryName(slug || "Категории");
      }
    }

    if (isListMode) setCategoryName("Категории");
    else if (slug) loadCategoryName();

    return () => {
      mounted = false;
    };
  }, [slug, apiSlug, isListMode]);

  // reset on slug change
  useEffect(() => {
    if (isListMode) return;

    setPhotoNews([]);
    setTextNews([]);
    setAuthorItems([]);
    setHasMore(true);
    setLoading(true);
    setPrefilled(false);
    setEmptyMessage("");
    pageRef.current = 1;

    setSubscribeOpen(false);
    if (subscribeTimerRef.current) {
      clearTimeout(subscribeTimerRef.current);
      subscribeTimerRef.current = 0;
    }
  }, [slug, isListMode]);

  // loadMore
  const loadMore = useCallback(
    async () => {
      if (isListMode) return;
      if (!apiSlug) return;
      if (loadingRef.current || !hasMoreRef.current) return;

      try {
        loadingRef.current = true;

        const page = pageRef.current;

        let data = await fetchCategoryNews(apiSlug, page);
        let results = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : [];

        const valid = results.filter(hasSomeText);

        if (isAuthorMaterialsCategory) {
          // Авторская категория: берём только авторские статьи (Article)
          const authorOnly = valid.filter(isAuthorArticleItem);

          setAuthorItems((prev) =>
            page === 1 ? authorOnly : [...prev, ...authorOnly]
          );

          const more = authorOnly.length > 0;
          setHasMore(more);
          hasMoreRef.current = more;

          if (page === 1 && authorOnly.length === 0) {
            setEmptyMessage(
              "В разделе «Авторские материалы» пока нет публикаций."
            );
          }

          pageRef.current = page + 1;
          return;
        }

        // обычная портальная логика для остальных категорий
        const withPhoto = valid.filter((n) => isImageOk(imageFromItem(n)));
        const withoutPhoto = valid.filter(
          (n) => !isImageOk(imageFromItem(n))
        );

        const seen = new Set(
          photoNews
            .map((n) => n?.id ?? n?.slug ?? null)
            .concat(textNews.map((n) => n?.id ?? n?.slug ?? null))
            .filter(Boolean)
        );

        const uniquePhoto = withPhoto.filter(
          (n) => !seen.has(n?.id ?? n?.slug ?? null)
        );
        const uniqueText = withoutPhoto.filter(
          (n) => !seen.has(n?.id ?? n?.slug ?? null)
        );

        setPhotoNews((prev) => [...prev, ...uniquePhoto]);
        setTextNews((prev) => [...prev, ...uniqueText]);

        const more = valid.length > 0;
        setHasMore(more);
        hasMoreRef.current = more;

        if (page === 1 && valid.length === 0) {
          setEmptyMessage("В этой категории пока нет новостей.");
        }

        pageRef.current = page + 1;
      } catch {
        setHasMore(false);
        hasMoreRef.current = false;
        if (pageRef.current === 1 && !emptyMessage) {
          setEmptyMessage("Не удалось загрузить материалы категории.");
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [apiSlug, isListMode, hasSomeText, photoNews, textNews, isAuthorMaterialsCategory, emptyMessage]
  );

  useEffect(() => {
    if (isListMode) return;
    if (!apiSlug) return;
    loadMore();
  }, [apiSlug, isListMode, loadMore]);

  // prefill (только для НЕ авторской категории)
  useEffect(() => {
    if (isListMode) return;
    if (isAuthorMaterialsCategory) return;
    if (prefilled) return;
    if (photoNews.length === 0 && textNews.length === 0) return;

    let cancelled = false;

    const fill = async () => {
      await new Promise((r) => requestAnimationFrame(r));

      for (let i = 0; i < 2; i++) {
        if (cancelled || !hasMoreRef.current) break;

        const el = blocksRef.current;
        const height = el?.getBoundingClientRect().height || 0;
        const needMore =
          photoNews.length < 6 ||
          height < window.innerHeight * 1.15;

        if (!needMore) {
          setPrefilled(true);
          break;
        }
        await loadMore();
      }
    };

    fill();
    return () => {
      cancelled = true;
    };
  }, [isListMode, isAuthorMaterialsCategory, photoNews.length, textNews.length, prefilled, loadMore]);

  // subscribe popup (не мешаем авторской категории лишним)
  useEffect(() => {
    if (isListMode) return;
    if (isAuthorMaterialsCategory) return;
    if (isNewsletterSubscribedNow()) return;
    if (isNewsletterDismissedNow()) return;

    const delay =
      NEWSLETTER_DELAY_MIN_MS +
      Math.floor(
        Math.random() *
          (NEWSLETTER_DELAY_MAX_MS - NEWSLETTER_DELAY_MIN_MS + 1)
      );

    subscribeTimerRef.current = setTimeout(() => {
      setSubscribeOpen(true);
    }, delay);

    return () => {
      if (subscribeTimerRef.current)
        clearTimeout(subscribeTimerRef.current);
      subscribeTimerRef.current = 0;
    };
  }, [isListMode, isAuthorMaterialsCategory]);

  const closeSubscribe = useCallback(() => {
    setSubscribeOpen(false);
    lsSetInt(NEWSLETTER_DISMISSED_AT_KEY, Date.now());
  }, []);

  const submitSubscribe = useCallback(async () => {
    lsSetBool(NEWSLETTER_SUBSCRIBED_KEY, true);
    setSubscribeOpen(false);
  }, []);

  const mixedBlocks = useMemo(() => {
    const photos = Array.isArray(photoNews) ? photoNews : [];
    const texts = Array.isArray(textNews) ? textNews : [];

    const blocks = [];
    let pi = 0;
    let ti = 0;

    const PHOTO_CHUNK = 3;
    const TEXT_CHUNK = 7;

    let mode = "photo";

    while (pi < photos.length || ti < texts.length) {
      if (mode === "photo") {
        const chunk = photos.slice(pi, pi + PHOTO_CHUNK);
        if (chunk.length) {
          blocks.push({ kind: "photo", items: chunk });
          pi += chunk.length;
        }
        mode = "text";
      } else {
        const chunk = texts.slice(ti, ti + TEXT_CHUNK);
        if (chunk.length) {
          blocks.push({ kind: "text", items: chunk });
          ti += chunk.length;
        } else {
          mode = "photo";
          continue;
        }
        mode = "photo";
      }
    }

    return blocks;
  }, [photoNews, textNews]);

  // SEO
  const categoryTitle =
    isAuthorMaterialsCategory
      ? "Авторские материалы"
      : prettifyCategoryName(apiSlug, categoryName) ||
        apiSlug ||
        "Новости";

  const pageNum = (() => {
    const raw = new URLSearchParams(location.search).get("page");
    const n = Number(raw || 0);
    return Number.isFinite(n) && n > 1 ? n : 0;
  })();

  const categoryCanonical = (() => {
    const base = `https://izotovlife.ru/${String(apiSlug || "")
      .replace(/^\/+|\/+$/g, "")
      .toString()}/`;
    return pageNum ? `${base}?page=${pageNum}` : base;
  })();

  // list mode
  if (isListMode) {
    return (
      <div className={s.page}>
        <Helmet>
          <title>Категории — IzotovLife</title>
          <meta
            name="description"
            content="Разделы новостей IzotovLife."
          />
          <link
            rel="canonical"
            href="https://izotovlife.ru/categories/"
          />
        </Helmet>

        <h1 style={VISUALLY_HIDDEN}>Категории</h1>

        {catsLoading ? (
          <div className={s.centerNote}>Загрузка…</div>
        ) : (
          <div className={s.categoriesGrid}>
            {allCategories.map((c) => {
              const slug0 = c?.slug || "";
              const name0 =
                prettifyCategoryName(
                  slug0,
                  c?.name || c?.title || slug0
                ) || slug0;
              const cover0 =
                coversRef.current?.[slug0] ||
                c?.cover ||
                c?.image ||
                "";
              const bg = isImageOk(cover0)
                ? { backgroundImage: `url(${cover0})` }
                : undefined;

              return (
                <Link
                  key={slug0}
                  to={`/${slug0}/`}
                  className={s.categoryCard}
                  style={bg}
                >
                  <div className={s.categoryCardOverlay} />
                  <div
                    className={s.categoryCardLabel}
                    style={CAT_LABEL_STYLE}
                  >
                    {name0}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const totalShown = isAuthorMaterialsCategory
    ? authorItems.length
    : photoNews.length + textNews.length;
  const showEmpty = totalShown === 0 && hasMore === false;

  return (
    <div className={s.page}>
      <Helmet>
        <title>
          {pageNum
            ? `${categoryTitle} — IzotovLife — страница ${pageNum}`
            : `${categoryTitle} — IzotovLife`}
        </title>
        <meta
          name="description"
          content={
            pageNum
              ? `Свежие новости из раздела «${categoryTitle}» на IzotovLife. Страница ${pageNum}.`
              : `Свежие новости из раздела «${categoryTitle}» на IzotovLife.`
          }
        />
        <link rel="canonical" href={categoryCanonical} />
      </Helmet>

      <div className={`${s.breadcrumbs} ${s.visuallyHidden}`}>
        <Link to="/">Главная</Link>
        <span>›</span>
        <span>{categoryTitle}</span>
      </div>

      <h1 style={VISUALLY_HIDDEN}>{categoryTitle}</h1>

      {isAuthorMaterialsCategory && (
        <div className={s.authorHeader}>
          <h2>Авторские материалы</h2>
          <p>Публикации авторов IzotovLife.</p>
        </div>
      )}

      <div className={s.portalGrid}>
        <main className={s.mainCol}>
          {showEmpty ? (
            <div className={s.centerNote}>
              {emptyMessage || "Пока ничего нет."}
            </div>
          ) : isAuthorMaterialsCategory ? (
            // УПРОЩЁННЫЙ СПИСОК АВТОРСКИХ МАТЕРИАЛОВ
            <InfiniteScroll
              dataLength={authorItems.length}
              next={loadMore}
              hasMore={hasMore}
              loader={
                authorItems.length === 0 ? (
                  <div className={s.centerNote}>Загрузка…</div>
                ) : null
              }
              endMessage={null}
              scrollThreshold="1200px"
            >
              <ul className={s.textList}>
                {authorItems.map((n, i) => {
                  const to = buildNewsUrl(n, apiSlug);
                  const title = n.titleParts ? n.titleParts[0] : n.title;
                  const audio = pickAudioFlag(n);

                  const teaserSource = n.summary || n.content || "";
                  const teaser =
                    typeof teaserSource === "string"
                      ? teaserSource
                          .replace(/<[^>]+>/g, "")
                          .slice(0, 180) +
                        (teaserSource.length > 180 ? "…" : "")
                      : "";

                  return (
                    <li
                      key={`author-${n.id ?? n.slug ?? i}`}
                      className={s.textItem}
                    >
                      <Link to={to} className={s.textLink}>
                        <div className={s.authorCard}>
                          <div className={s.authorCardTitle}>
                            <strong>{title}</strong>
                            {audio && (
                              <span className={s.badge}>аудио</span>
                            )}
                          </div>
                          {teaser && (
                            <div className={s.authorCardTeaser}>
                              {teaser}
                            </div>
                          )}
                          <div className={s.authorCardMeta}>
                            <SourceLabel item={n} />
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </InfiniteScroll>
          ) : (
            // ПОРТАЛЬНЫЙ РЕЖИМ ДЛЯ ОСТАЛЬНЫХ КАТЕГОРИЙ
            <InfiniteScroll
              dataLength={totalShown}
              next={loadMore}
              hasMore={hasMore}
              loader={<div className={s.centerNote}>Загрузка…</div>}
              endMessage={
                <div className={s.centerNote}>
                  {emptyMessage ? emptyMessage : "Больше новостей нет"}
                </div>
              }
              scrollThreshold="1200px"
            >
              <div ref={blocksRef} className={s.blocks}>
                {mixedBlocks.map((b, idx) => {
                  if (b.kind === "photo") {
                    return (
                      <section
                        key={`b-photo-${idx}`}
                        className={s.block}
                      >
                        <div className={s.photoGrid}>
                          {b.items.map((item, i) => (
                            <NewsCard
                              key={`p-${item.id ?? item.slug ?? `${idx}-${i}`}`}
                              item={item}
                              eager={idx === 0 && i < 3}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  }

                  return (
                    <section
                      key={`b-text-${idx}`}
                      className={s.block}
                    >
                      <ul className={s.textList}>
                        {b.items.map((n, i) => {
                          const to = buildNewsUrl(n, apiSlug);
                          const title = n.titleParts
                            ? n.titleParts[0]
                            : n.title;
                          const audio = pickAudioFlag(n);

                          return (
                            <li
                              key={`t-${n.id ?? n.slug ?? idx}-${i}`}
                              className={s.textItem}
                            >
                              <Link to={to} className={s.textLink}>
                                <span className={s.textTitle}>
                                  {title}
                                  {audio && (
                                    <span className={s.badge}>
                                      аудио
                                    </span>
                                  )}
                                </span>
                                <span className={s.textMeta}>
                                  <SourceLabel item={n} />
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </InfiniteScroll>
          )}
        </main>
      </div>

      {!isAuthorMaterialsCategory && (
        <IncomingNewsTray
          mode="subscribe"
          open={subscribeOpen}
          title="Подписаться на новости"
          policyHref="/politika-konfidencialnosti/"
          onClose={closeSubscribe}
          onSubmitSubscribe={submitSubscribe}
          subscribeNote="Отписка в 1 клик в каждом письме."
        />
      )}
    </div>
  );
}
