// Путь: frontend/src/pages/FeedPage.js
// Назначение: Главная лента IzotovLife в портальном стиле.
//
// ВАРИАНТ С ФИКСОМ:
//   - вместо связки fetchNews + fetchNewsFeedImages используется единая лента fetchNewsFeedText
//   - текстовые и фото‑новости подгружаются бесконечно, пока backend отдаёт next
//   - разделение на фото/текст делается как в CategoryPage
//   - исключена ситуация, когда лента живёт только за счёт фото при отсутствии текста

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import { fetchNewsFeedText } from "../Api";
import SourceLabel from "../components/SourceLabel";
import NewsCard from "../components/NewsCard";
import IncomingNewsTray from "../components/IncomingNewsTray";

import s from "./FeedPage.module.css";

/* =========================
   localStorage cache (instant feed)
   ========================= */

const FEED_CACHE_KEY = "il_home_feed_cache_v1";
const FEED_CACHE_TTL_MS = 3 * 60 * 1000;
const FEED_CACHE_MAX_PHOTO = 30;
const FEED_CACHE_MAX_TEXT = 50;

/* =========================
   UI toggles
   ========================= */

const DISABLE_FRESH_NEWS_TRAY = true;

/* =========================
   Newsletter subscribe popup
   ========================= */

const NEWSLETTER_SUBSCRIBED_KEY = "il_newsletter_subscribed_v1";
const NEWSLETTER_DISMISSED_AT_KEY = "il_newsletter_dismissed_at_v1";
const NEWSLETTER_DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function safeJsonParse(s0) {
  try {
    return JSON.parse(s0);
  } catch {
    return null;
  }
}

function readFeedCache() {
  try {
    const raw = localStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return null;

    const parsed = safeJsonParse(raw);
    if (!parsed || !parsed.ts) return null;

    if (Date.now() - parsed.ts > FEED_CACHE_TTL_MS) return null;

    return {
      ts: parsed.ts,
      photo: Array.isArray(parsed.photo) ? parsed.photo : [],
      text: Array.isArray(parsed.text) ? parsed.text : [],
    };
  } catch {
    return null;
  }
}

function writeFeedCache(photo, text) {
  try {
    const payload = {
      ts: Date.now(),
      photo: Array.isArray(photo) ? photo.slice(0, FEED_CACHE_MAX_PHOTO) : [],
      text: Array.isArray(text) ? text.slice(0, FEED_CACHE_MAX_TEXT) : [],
    };
    localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

/* =========================
   helpers
   ========================= */

function stripHtmlFast(htmlOrText) {
  const s0 = String(htmlOrText || "");
  const noTags = s0.replace(/<[^>]*>/g, " ");
  return noTags
    .replace(/\u00a0|\u202f/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^[.,!?:;\-—–\s]+|[.,!?:;\-—–\s]+$/g, "");
}

function normalizeImageFields(item) {
  if (!item || typeof item !== "object") return item;

  const pick =
    item.image ||
    item.image_url ||
    item.cover_image ||
    item.preview_image ||
    item.thumbnail ||
    item.thumb ||
    item.picture ||
    item.photo ||
    item.img ||
    "";

  const pickStr = String(pick || "").trim();
  if (!pickStr) return item;

  const cur = String(item.image || "").trim();
  if (cur) return item;

  return { ...item, image: pickStr };
}

function toTitleParts(item) {
  return {
    ...item,
    titleParts: (item.title || "").split("//").map((t) => t.trim()),
  };
}

function getSourceLabel(n) {
  if (!n) return "Источник неизвестен";

  if (n?.source?.name) return String(n.source.name);

  if (typeof n?.source === "string" && n.source.trim())
    return n.source.trim();

  const link = n?.link || n?.url || n?.source_url;
  if (typeof link === "string" && link.startsWith("http")) {
    try {
      const u = new URL(link);
      return u.hostname.replace(/^www\./i, "");
    } catch {
      // ignore
    }
  }

  return "Источник неизвестен";
}

function getScrollContainerFromElement(el) {
  try {
    let cur = el;
    while (cur) {
      const cs = window.getComputedStyle(cur);
      const oy = cs && cs.overflowY ? cs.overflowY : "visible";
      const isScrollable = oy === "auto" || oy === "scroll";
      if (isScrollable) return cur;
      cur = cur.parentElement;
    }
  } catch {
    // ignore
  }
  return null;
}

// newsletter helpers
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
  } catch {
    // ignore
  }
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
  } catch {
    // ignore
  }
}
function isNewsletterDismissedNow() {
  const dismissedAt = lsGetInt(NEWSLETTER_DISMISSED_AT_KEY);
  if (!dismissedAt) return false;
  return Date.now() - dismissedAt < NEWSLETTER_DISMISS_TTL_MS;
}
function isNewsletterSubscribedNow() {
  return lsGetBool(NEWSLETTER_SUBSCRIBED_KEY);
}

export default function FeedPage() {
  const [photoNews, setPhotoNews] = useState([]);
  const [textNews, setTextNews] = useState([]);

  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const loadingRef = useRef(false);

  const seenPhotoKeysRef = useRef(new Set());
  const seenTextKeysRef = useRef(new Set());

  const [incoming, setIncoming] = useState([]);
  const lastTopKeyRef = useRef(null);

  const feedWrapRef = useRef(null);
  const sentinelRef = useRef(null);

  const hasMoreRef = useRef(true);
  const userHasScrolledRef = useRef(false);
  const autoFillBudgetRef = useRef(2);
  const lastAppendAtRef = useRef(0);

  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const subscribeTimerRef = useRef(0);

  const pageRef = useRef(1);

  useEffect(() => {
    hasMoreRef.current = Boolean(hasMore);
  }, [hasMore]);

  const debug = useMemo(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get("debugfeed") === "1";
    } catch {
      return false;
    }
  }, []);

  const [dbg, setDbg] = useState({
    lastMode: "",
    txtReqPage: 0,
    txtRawLen: 0,
    imgAdded: 0,
    txtAdded: 0,
    txtNext: "",
    hasMore: true,
    userHasScrolled: false,
    autoFillBudget: 2,
    lastError: "",
    lastTs: 0,
  });

  const getKey = useCallback((item) => {
    if (!item) return "";
    const id = item.id ?? item.pk ?? "";
    const slug = item.slug ?? "";
    const link = item.link ?? item.url ?? item.external_url ?? "";
    return String(id || slug || link || "");
  }, []);

  const rebuildSeenSets = useCallback(
    (photo, text) => {
      const sPhoto = new Set();
      const sText = new Set();

      for (const n of photo || []) {
        const k = getKey(n);
        if (k) sPhoto.add(k);
      }
      for (const n of text || []) {
        const k = getKey(n);
        if (k) sText.add(k);
      }

      seenPhotoKeysRef.current = sPhoto;
      seenTextKeysRef.current = sText;
    },
    [getKey]
  );

  const isStopText = useCallback((s0) => {
    const s1 = stripHtmlFast(s0);
    if (!s1) return true;
    return (
      s1 === "без текста" ||
      s1 === "нет текста" ||
      s1 === "no text" ||
      s1 === "notext" ||
      s1 === "n/a" ||
      s1 === "-" ||
      s1 === "—" ||
      s1 === "–"
    );
  }, []);

  const hasSomeText = useCallback(
    (n) => {
      if (!n) return false;
      const title0 = stripHtmlFast(n.title || "");
      const body0 = stripHtmlFast(
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

      const MIN_LEN = 8;
      const okTitle = !!title0 && !isStopText(title0);
      const okBody = !!body0 && !isStopText(body0) && body0.length >= MIN_LEN;
      return okTitle || okBody;
    },
    [isStopText]
  );

  const hasValidImage = useCallback((n) => {
    const u =
      n?.image ||
      n?.image_url ||
      n?.cover_image ||
      n?.preview_image ||
      n?.thumbnail ||
      n?.photo ||
      n?.img ||
      "";
    const s0 = String(u || "").trim();
    if (!s0) return false;

    const s1 = s0.toLowerCase();
    if (s1.includes("default_news.svg")) return false;
    if (s1.includes("default")) return false;

    if (
      s1.endsWith(".mp3") ||
      s1.endsWith(".ogg") ||
      s1.endsWith(".wav") ||
      s1.includes("audio")
    )
      return false;

    if (
      !(
        s1.startsWith("http://") ||
        s1.startsWith("https://") ||
        s1.startsWith("/")
      )
    )
      return false;

    return true;
  }, []);

  const buildSeoUrl = useCallback((n) => {
    if (!n) return "/";
    if (n.seo_url) return n.seo_url;

    const safeCat =
      n?.category?.slug || n?.category_slug || n?.category || "";
    const safeSlug = n?.slug || "";
    if (!safeCat || !safeSlug) return "/";

    return `/${safeCat}/${safeSlug}/`;
  }, []);

  const updateDebug = useCallback(
    (patch) => {
      if (!debug) return;
      setDbg((prev) => ({
        ...prev,
        ...patch,
        hasMore: Boolean(hasMoreRef.current),
        userHasScrolled: Boolean(userHasScrolledRef.current),
        autoFillBudget: Number(autoFillBudgetRef.current || 0),
        lastTs: Date.now(),
      }));
    },
    [debug]
  );

  const canAppendNow = useCallback(() => {
    const now = Date.now();
    if (now - lastAppendAtRef.current < 650) return false;
    lastAppendAtRef.current = now;
    return true;
  }, []);

  const loadNews = useCallback(
    async (mode = "append") => {
      if (mode !== "replace" && !hasMoreRef.current) return;
      if (loadingRef.current) return;

      if (mode === "append") {
        const okByScroll = userHasScrolledRef.current === true;
        const okByAutoFill = (autoFillBudgetRef.current || 0) > 0;
        if (!okByScroll && !okByAutoFill) return;

        if (!canAppendNow()) return;

        if (!okByScroll && okByAutoFill) {
          autoFillBudgetRef.current -= 1;
        }
      }

      loadingRef.current = true;
      setIsLoading(true);
      updateDebug({ lastMode: mode, lastError: "" });

      const TXT_PAGE_SIZE = 30;

      const currentPage = mode === "replace" ? 1 : pageRef.current;

      try {
        if (mode === "replace") {
          setHasMore(true);
          hasMoreRef.current = true;
          autoFillBudgetRef.current = 2;
          lastAppendAtRef.current = 0;
          updateDebug({ lastMode: "replace" });
        }

        const payload = await fetchNewsFeedText({
          page: currentPage,
          page_size: TXT_PAGE_SIZE,
        });

        const rawList = Array.isArray(payload?.results)
          ? payload.results
          : [];

        const normalized = rawList
          .map(normalizeImageFields)
          .map(toTitleParts);

        const valid = normalized.filter(hasSomeText);

        const withPhoto = valid.filter(hasValidImage);
        const withoutPhoto = valid.filter((n) => !hasValidImage(n));

        const seen = new Set(
          (mode === "replace" ? [] : photoNews)
            .map((n) => n?.id ?? n?.slug ?? null)
            .concat(
              (mode === "replace" ? [] : textNews).map(
                (n) => n?.id ?? n?.slug ?? null
              )
            )
            .filter(Boolean)
        );

        const uniquePhoto = withPhoto.filter(
          (n) => !seen.has(n?.id ?? n?.slug ?? null)
        );
        const uniqueText = withoutPhoto.filter(
          (n) => !seen.has(n?.id ?? n?.slug ?? null)
        );

        if (currentPage === 1) {
          const top = uniquePhoto[0] || uniqueText[0] || null;
          if (top) lastTopKeyRef.current = getKey(top);
        }

        updateDebug({
          txtReqPage: currentPage,
          txtRawLen: rawList.length,
          imgAdded: uniquePhoto.length,
          txtAdded: uniqueText.length,
          txtNext: String(payload?.next || ""),
        });

        if (mode === "replace") {
          setPhotoNews(uniquePhoto);
          setTextNews(uniqueText);

          rebuildSeenSets(uniquePhoto, uniqueText);
          writeFeedCache(uniquePhoto, uniqueText);
        } else {
          if (uniquePhoto.length)
            setPhotoNews((prev) => [...prev, ...uniquePhoto]);
          if (uniqueText.length)
            setTextNews((prev) => [...prev, ...uniqueText]);

          const allPhoto = (photoNews || []).concat(uniquePhoto);
          const allText = (textNews || []).concat(uniqueText);
          rebuildSeenSets(allPhoto, allText);
          writeFeedCache(allPhoto, allText);
        }

        const more = Boolean(payload?.next) && valid.length > 0;
        setHasMore(more);
        hasMoreRef.current = more;

        pageRef.current = currentPage + 1;
      } catch (e) {
        updateDebug({
          lastError: String(e && e.message ? e.message : e),
        });
        setHasMore(false);
        hasMoreRef.current = false;
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    },
    [
      canAppendNow,
      getKey,
      hasSomeText,
      hasValidImage,
      photoNews,
      textNews,
      rebuildSeenSets,
      updateDebug,
    ]
  );

  useEffect(() => {
    const cached = readFeedCache();
    if (cached && (cached.photo.length || cached.text.length)) {
      setPhotoNews(cached.photo);
      setTextNews(cached.text);
      rebuildSeenSets(cached.photo, cached.text);

      pageRef.current = 2;

      setIsLoading(false);

      setTimeout(() => loadNews("replace"), 60);
    } else {
      loadNews("replace");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pollIncoming = useCallback(async () => {
    if (DISABLE_FRESH_NEWS_TRAY) return;

    try {
      const data = await fetchNewsFeedText({ page: 1, page_size: 20 });
      const results = (Array.isArray(data?.results) ? data.results : []).map(
        normalizeImageFields
      );

      const valid = results.filter(hasSomeText);
      if (!valid.length) return;

      if (!lastTopKeyRef.current) {
        lastTopKeyRef.current = getKey(valid[0]);
        return;
      }

      const collected = [];
      for (const n of valid) {
        const k = getKey(n);
        if (!k) continue;
        if (k === lastTopKeyRef.current) break;
        collected.push(n);
      }

      if (collected.length) {
        setIncoming((prev) => collected.map(toTitleParts).concat(prev));
        lastTopKeyRef.current = getKey(valid[0]);
      }
    } catch {
      // ignore
    }
  }, [getKey, hasSomeText]);

  useEffect(() => {
    if (DISABLE_FRESH_NEWS_TRAY) return;
    const t = setInterval(pollIncoming, 20000);
    return () => clearInterval(t);
  }, [pollIncoming]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const wrap = feedWrapRef.current;
    const sc = getScrollContainerFromElement(wrap) || null;

    let raf = 0;

    const onScroll = () => {
      userHasScrolledRef.current = true;

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!hasMoreRef.current) return;
        if (loadingRef.current) return;

        const rootEl = sc || document.documentElement;
        const nearBottom =
          rootEl.scrollTop + rootEl.clientHeight >=
          rootEl.scrollHeight - 900;
        if (nearBottom) loadNews("append");
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;

        if (!e.isIntersecting) return;
        if (!hasMoreRef.current) return;
        if (loadingRef.current) return;

        const okByScroll = userHasScrolledRef.current === true;
        const okByAutoFill = (autoFillBudgetRef.current || 0) > 0;
        if (!okByScroll && !okByAutoFill) return;

        loadNews("append");
      },
      { root: sc, rootMargin: "600px 0px 600px 0px", threshold: 0.01 }
    );

    io.observe(sentinel);

    if (sc) sc.addEventListener("scroll", onScroll, { passive: true });
    else window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      io.disconnect();
      if (sc) sc.removeEventListener("scroll", onScroll);
      else window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [loadNews]);

  useEffect(() => {
    if (isNewsletterSubscribedNow()) return;
    if (isNewsletterDismissedNow()) return;

    if (subscribeTimerRef.current) clearTimeout(subscribeTimerRef.current);

    const delay = 5000 + Math.floor(Math.random() * 5001);
    subscribeTimerRef.current = window.setTimeout(() => {
      setSubscribeOpen(true);
    }, delay);

    return () => {
      if (subscribeTimerRef.current) {
        clearTimeout(subscribeTimerRef.current);
        subscribeTimerRef.current = 0;
      }
    };
  }, []);

  const closeSubscribe = useCallback(() => {
    setSubscribeOpen(false);
    lsSetInt(NEWSLETTER_DISMISSED_AT_KEY, Date.now());
  }, []);

  const submitSubscribe = useCallback(async (email) => {
    try {
      const r = await fetch(`/api/newsletter/subscribe/`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ email }),
        credentials: "same-origin",
      });

      let data = null;
      try {
        data = await r.json();
      } catch (_) {
        data = null;
      }

      if (!r.ok) {
        return {
          ok: false,
          email_sent: false,
          already_registered: false,
          message:
            (data && data.message) ||
            `Ошибка подписки (HTTP ${r.status})`,
        };
      }

      const out = {
        ok: !!(data && data.ok),
        email_sent: !!(data && data.email_sent),
        already_registered: !!(data && data.already_registered),
        message: (data && data.message) || "",
      };

      if (out.ok) {
        lsSetBool("iz_subscribed", true);
      }

      return out;
    } catch (e) {
      return {
        ok: false,
        email_sent: false,
        already_registered: false,
        message: "Ошибка сети. Попробуйте позже.",
      };
    }
  }, []);

  // ===== Формирование портальных блоков (как в CategoryPage) =====

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
        // не продолжаем бесконечный хвост фото, если текстов нет
        if (chunk.length && texts.length > 0) {
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
          // текст закончился — выходим, чтобы не было хвоста только из фото
          break;
        }
        mode = "photo";
      }
    }

    return blocks;
  }, [photoNews, textNews]);

  const totalShown = photoNews.length + textNews.length;
  const showEmpty = totalShown === 0 && !hasMore && !isLoading;

  return (
    <div className={s["feed-page"]} ref={feedWrapRef}>
      <Helmet>
        <title>IzotovLife — главная лента новостей</title>
        <meta
          name="description"
          content="Главная лента IzotovLife: главное за день, новости с фото и текстовые новости из разных источников."
        />
        <link rel="canonical" href="https://izotovlife.ru/" />
      </Helmet>

      <div className="max-w-7xl mx-auto">
        {debug && (
          <div
            style={{
              position: "sticky",
              top: 6,
              zIndex: 50,
              marginBottom: 10,
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.9)",
              backdropFilter: "blur(8px)",
              fontSize: 12,
              lineHeight: 1.35,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>debugfeed=1</div>
            <div>
              mode: {dbg.lastMode} | hasMore: {String(hasMore)} | loading:{" "}
              {String(isLoading)}
            </div>
            <div>
              txtPageRef={pageRef.current} | req txt={dbg.txtReqPage}
            </div>
            <div>
              rawLen: txt={dbg.txtRawLen} | added: img={dbg.imgAdded} txt={
                dbg.txtAdded
              }
            </div>
            <div>
              next: txt={dbg.txtNext ? "yes" : "no"} | hasMore:{" "}
              {String(dbg.hasMore)}
            </div>
            <div>
              userScrolled: {String(dbg.userHasScrolled)} | autoFillBudget:{" "}
              {dbg.autoFillBudget} | lastError: {dbg.lastError || "-"}
            </div>
          </div>
        )}

        <div className={s.portalGrid}>
          <main className={s.mainCol}>
            {/* sentinel для infinite scroll */}
            <div ref={sentinelRef} style={{ height: 1 }} />

            {showEmpty ? (
              <div className={s.centerNote}>Пока ничего нет.</div>
            ) : (
              <div className={s.blocks}>
                {mixedBlocks.map((b, idx) => {
                  if (b.kind === "photo") {
                    return (
                      <section key={`b-photo-${idx}`} className={s.block}>
                        <div className={s.photoGrid}>
                          {b.items.map((item, i) => (
                            <NewsCard
                              key={`p-${item.id ?? item.slug ?? `${idx}-${i}`}`}
                              item={item}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  }

                  return (
                    <section key={`b-text-${idx}`} className={s.block}>
                      <ul className={s.textList}>
                        {b.items.map((n, i) => (
                          <li
                            key={`t-${n.id ?? n.slug ?? `${idx}-${i}`}`}
                            className={s.textItem}
                          >
                            <Link to={buildSeoUrl(n)} className={s.textLink}>
                              <span className={s.textTitle}>
                                {n.titleParts ? n.titleParts[0] : n.title}
                              </span>
                              <span className={s.textMeta}>
                                <SourceLabel item={n} />
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}

                {!hasMore && !isLoading && totalShown > 0 && (
                  <div className={s.centerNote}>Больше новостей нет</div>
                )}
                {isLoading && (
                  <div className={s.centerNote}>Загрузка…</div>
                )}
              </div>
            )}
          </main>
        </div>

        {/* Popup-подписка */}
        <IncomingNewsTray
          mode="subscribe"
          open={subscribeOpen}
          title="Подписаться на новости"
          policyHref="/politika-konfidencialnosti/"
          onClose={closeSubscribe}
          onSubmitSubscribe={submitSubscribe}
          subscribeNote="Отписка в 1 клик в каждом письме."
        />

        {/* Входящие новости (сейчас выключено через DISABLE_FRESH_NEWS_TRAY) */}
        <IncomingNewsTray
          items={incoming}
          maxRows={3}
          gap={8}
          open={!DISABLE_FRESH_NEWS_TRAY && !subscribeOpen}
          renderItem={(n) => (
            <Link
              to={buildSeoUrl(n)}
              className="no-underline"
              style={{ color: "inherit" }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {n.titleParts ? n.titleParts[0] : n.title}
              </div>

              <div
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Источник: {getSourceLabel(n)}
              </div>
            </Link>
          )}
        />
      </div>
    </div>
  );
}
