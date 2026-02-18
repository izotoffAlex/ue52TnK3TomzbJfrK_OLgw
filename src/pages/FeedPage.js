// Путь: frontend/src/pages/FeedPage.js
// Назначение: Главная лента IzotovLife в портальном стиле.
//
// Структура:
//   🔹 Hero-блок "Главное сейчас" с крупной карточкой (size="large")
//   🔹 Блок "Свежие новости" (текстовый)
//   🔹 Далее — смешанные фото/текст-блоки (как в категориях)
//
// Логика загрузки/кэширования/дедупликации сохранена из прежней версии.

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import { fetchNews, fetchNewsFeedImages } from "../Api";
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

function normalizeFeedPayload(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;

  if (data && typeof data === "object") {
    for (const v of Object.values(data)) {
      if (Array.isArray(v) && v.length) return v;
    }
  }
  return [];
}

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

  const pageImagesRef = useRef(1);
  const pageTextRef = useRef(1);
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
    imgReqPage: 0,
    txtReqPage: 0,
    imgRawLen: 0,
    txtRawLen: 0,
    imgAdded: 0,
    txtAdded: 0,
    imgNext: "",
    txtNext: "",
    combinedHasNext: null,
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

  const dedupeInto = useCallback(
    (list, seenSet) => {
      const out = [];
      for (const item of list) {
        const k = getKey(item);
        if (!k) {
          out.push(item);
          continue;
        }
        if (seenSet.has(k)) continue;
        seenSet.add(k);
        out.push(item);
      }
      return out;
    },
    [getKey]
  );

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

      const IMG_PAGE_SIZE = 20;
      const TXT_PAGE_SIZE = 20;

      const TEXT_MIN_FIRST_LOAD = 20;
      const TEXT_MIN_ADD_PER_APPEND = 12;
      const TEXT_MAX_PAGES_PER_APPEND = 6;

      const currentImagesPage = mode === "replace" ? 1 : pageImagesRef.current;
      const startTextPage = mode === "replace" ? 1 : pageTextRef.current;

      try {
        if (mode === "replace") {
          setHasMore(true);
          autoFillBudgetRef.current = 2;
          lastAppendAtRef.current = 0;
          updateDebug({ lastMode: "replace" });
        }

        let imagesPayload = null;
        let textPayloadFirst = null;
        let usedFallbackCombined = false;

        try {
          [imagesPayload, textPayloadFirst] = await Promise.all([
            fetchNewsFeedImages({
              page: currentImagesPage,
              page_size: IMG_PAGE_SIZE,
            }),
            fetchNews(startTextPage, TXT_PAGE_SIZE),
          ]);
        } catch {
          usedFallbackCombined = true;
          const fallbackData = await fetchNews(
            currentImagesPage,
            Math.max(IMG_PAGE_SIZE, TXT_PAGE_SIZE)
          );
          imagesPayload = fallbackData;
          textPayloadFirst = fallbackData;
        }

        const rawImagesList = normalizeFeedPayload(imagesPayload);
        const rawTextFirstList = normalizeFeedPayload(textPayloadFirst);

        const imagesCandidate = rawImagesList.map(normalizeImageFields);

        let imagesValid = imagesCandidate.filter(hasSomeText);
        if (!imagesValid.length && imagesCandidate.length)
          imagesValid = imagesCandidate;

        const imagesUnique =
          mode === "replace"
            ? imagesValid
            : dedupeInto(imagesValid, seenPhotoKeysRef.current);

        let cardsBatch = imagesUnique.filter(hasValidImage);
        if (!cardsBatch.length) cardsBatch = imagesUnique;

        const withPhotoProcessed = cardsBatch.map(toTitleParts);

        const photoExcludeSet = (() => {
          const s0 = new Set();
          for (const n of withPhotoProcessed) {
            const k = getKey(n);
            if (k) s0.add(k);
          }
          return s0;
        })();

        const buildTextBatchFromRaw = (rawList, modeLocal) => {
          let textCandidate = rawList.filter(hasSomeText);
          if (!textCandidate.length && rawList.length) textCandidate = rawList;

          let filtered = textCandidate;
          if (photoExcludeSet && photoExcludeSet.size) {
            filtered = textCandidate.filter((n) => {
              const k = getKey(n);
              if (!k) return true;
              return !photoExcludeSet.has(k);
            });
          }

          const preferNoImg = filtered.filter((n) => !hasValidImage(n));
          const withImg = filtered.filter((n) => hasValidImage(n));
          const ordered = preferNoImg.concat(withImg);

          if (modeLocal === "replace") {
            const tmp = new Set();
            const out = [];
            for (const n of ordered) {
              const k = getKey(n);
              if (k) {
                if (tmp.has(k)) continue;
                tmp.add(k);
              }
              out.push(n);
            }
            return out.map(toTitleParts);
          }

          return dedupeInto(ordered, seenTextKeysRef.current).map(toTitleParts);
        };

        let collectedTextProcessed = buildTextBatchFromRaw(
          rawTextFirstList,
          mode
        );

        let lastTextPayload = textPayloadFirst;
        let textPageCursor = startTextPage;

        if (!usedFallbackCombined) {
          const needMin =
            mode === "replace" ? TEXT_MIN_FIRST_LOAD : TEXT_MIN_ADD_PER_APPEND;

          let guard = 0;

          const hasTextNextStrong = (p, rawList) => {
            const hasNext = Boolean(p && p.next);
            const hasLen =
              Array.isArray(rawList) && rawList.length >= TXT_PAGE_SIZE;
            return hasNext || hasLen;
          };

          let hasTextNext = hasTextNextStrong(lastTextPayload, rawTextFirstList);

          while (
            collectedTextProcessed.length < needMin &&
            hasTextNext &&
            guard < TEXT_MAX_PAGES_PER_APPEND
          ) {
            guard += 1;
            const nextPage = textPageCursor + 1;

            try {
              const nextPayload = await fetchNews(nextPage, TXT_PAGE_SIZE);
              lastTextPayload = nextPayload;

              const rawNext = normalizeFeedPayload(nextPayload);
              const batchNext = buildTextBatchFromRaw(rawNext, "append");
              if (batchNext.length) {
                collectedTextProcessed =
                  collectedTextProcessed.concat(batchNext);
              }

              textPageCursor = nextPage;
              hasTextNext = hasTextNextStrong(nextPayload, rawNext);
            } catch {
              break;
            }
          }
        }

        if (currentImagesPage === 1) {
          const top =
            withPhotoProcessed[0] || collectedTextProcessed[0] || null;
          if (top) lastTopKeyRef.current = getKey(top);
        }

        const imgHasNext =
          Boolean(imagesPayload && imagesPayload.next) ||
          rawImagesList.length >= IMG_PAGE_SIZE;

        const rawTextLastList = normalizeFeedPayload(lastTextPayload);
        const txtHasNext = usedFallbackCombined
          ? Boolean(textPayloadFirst && textPayloadFirst.next) ||
            rawTextFirstList.length >= TXT_PAGE_SIZE
          : Boolean(lastTextPayload && lastTextPayload.next) ||
            rawTextLastList.length >= TXT_PAGE_SIZE;

        const combinedHasNext = Boolean(imgHasNext || txtHasNext);

        updateDebug({
          imgReqPage: currentImagesPage,
          txtReqPage: startTextPage,
          imgRawLen: rawImagesList.length,
          txtRawLen: rawTextFirstList.length,
          imgAdded: withPhotoProcessed.length,
          txtAdded: collectedTextProcessed.length,
          imgNext: String((imagesPayload && imagesPayload.next) || ""),
          txtNext: String((lastTextPayload && lastTextPayload.next) || ""),
          combinedHasNext,
        });

        if (mode === "replace") {
          setPhotoNews(withPhotoProcessed);
          setTextNews(collectedTextProcessed);

          rebuildSeenSets(withPhotoProcessed, collectedTextProcessed);
          writeFeedCache(withPhotoProcessed, collectedTextProcessed);

          pageImagesRef.current = 2;
          pageTextRef.current = textPageCursor + 1;

          setHasMore(combinedHasNext);
        } else {
          if (withPhotoProcessed.length)
            setPhotoNews((prev) => [...prev, ...withPhotoProcessed]);
          if (collectedTextProcessed.length)
            setTextNews((prev) => [...prev, ...collectedTextProcessed]);

          pageImagesRef.current = currentImagesPage + 1;
          pageTextRef.current = textPageCursor + 1;

          if (!combinedHasNext) {
            setHasMore(false);
            return;
          }

          setHasMore(true);
        }
      } catch (e) {
        updateDebug({
          lastError: String(e && e.message ? e.message : e),
        });
        setHasMore(false);
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    },
    [
      canAppendNow,
      dedupeInto,
      getKey,
      hasSomeText,
      hasValidImage,
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

      pageImagesRef.current = 2;
      pageTextRef.current = 2;

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
      const data = await fetchNews(1, 20);
      const results = normalizeFeedPayload(data).map(normalizeImageFields);

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

  // ===== Формирование портальных блоков =====

  const heroPhotoItems = useMemo(
    () => (Array.isArray(photoNews) ? photoNews.slice(0, 3) : []),
    [photoNews]
  );
  const restPhotoItems = useMemo(
    () => (Array.isArray(photoNews) ? photoNews.slice(3) : []),
    [photoNews]
  );

  const firstTextBlockItems = useMemo(
    () => (Array.isArray(textNews) ? textNews.slice(0, 7) : []),
    [textNews]
  );
  const restTextItems = useMemo(
    () => (Array.isArray(textNews) ? textNews.slice(7) : []),
    [textNews]
  );

  const mixedBlocks = useMemo(() => {
    const photos = restPhotoItems;
    const texts = restTextItems;

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
  }, [restPhotoItems, restTextItems]);

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
              pages: imgRef={pageImagesRef.current} txtRef={
                pageTextRef.current
              }{" "}
              | req img={dbg.imgReqPage} txt={dbg.txtReqPage}
            </div>
            <div>
              rawLen: img={dbg.imgRawLen} txt={dbg.txtRawLen} | added: img={
                dbg.imgAdded
              }{" "}
              txt={dbg.txtAdded}
            </div>
            <div>
              next: img={dbg.imgNext ? "yes" : "no"} txt={
                dbg.txtNext ? "yes" : "no"
              }{" "}
              | combinedHasNext: {String(dbg.combinedHasNext)}
            </div>
            <div>
              userScrolled: {String(dbg.userHasScrolled)} | autoFillBudget:{" "}
              {dbg.autoFillBudget} | lastError: {dbg.lastError || "-"}
            </div>
          </div>
        )}

        <div className={s.portalGrid}>
          <main className={s.mainCol}>
            <div ref={sentinelRef} style={{ height: 1 }} />

            {/* HERO-БЛОК "ГЛАВНОЕ СЕЙЧАС" */}
            {heroPhotoItems.length > 0 && (
              <section className={s.block}>
                <h2 className={s.sectionTitle}>Главное сейчас</h2>
                <div className={`${s.photoGrid} ${s.heroGrid}`}>
                  {heroPhotoItems.map((item, i) => (
                    <div
                      key={`hero-${item.id ?? item.slug ?? i}`}
                      className={
                        i === 0 ? `${s.photoItem} ${s.heroMain}` : s.photoItem
                      }
                    >
                      <NewsCard item={item} size="large" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ПЕРВЫЙ ТЕКСТОВЫЙ БЛОК "СВЕЖИЕ НОВОСТИ" */}
            {firstTextBlockItems.length > 0 && (
              <section className={s.block}>
                <h2 className={s.sectionTitle}>Свежие новости</h2>
                <ul className={s.textList}>
                  {firstTextBlockItems.map((n, i) => (
                    <li
                      key={`first-text-${n.id ?? n.slug ?? i}`}
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
            )}

            {/* ОСНОВНАЯ ЛЕНТА: СМЕШАННЫЕ БЛОКИ */}
            <div className={s.blocks}>
              {mixedBlocks.map((b, idx) => {
                if (b.kind === "photo") {
                  return (
                    <section key={`b-photo-${idx}`} className={s.block}>
                      <div className={s.photoGrid}>
                        {b.items.map((item, i) => (
                          <div
                            key={`p-${item.id ?? item.slug ?? `${idx}-${i}`}`}
                            className={s.photoItem}
                          >
                            <NewsCard
                              item={item}
                              // здесь оставляем обычный размер
                              size="normal"
                            />
                          </div>
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
                          <Link
                            to={buildSeoUrl(n)}
                            className={s.textLink}
                          >
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

              {!hasMore && (
                <div className={s.centerNote}>Больше новостей нет</div>
              )}
              {isLoading && hasMore && (
                <div className={s.centerNote}>Загрузка…</div>
              )}
            </div>
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
