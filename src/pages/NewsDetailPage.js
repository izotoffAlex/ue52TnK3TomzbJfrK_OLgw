// Путь: frontend/src/pages/NewsDetailPage.js
//
// Назначение: Детальная страница новости (Article или ImportedNews).
//
// ДОПОЛНЕНО (2026-02-13 SEO+COMMENT):
// ✅ Поддержка полей seo_title, seo_description из API (Article/ImportedNews).
// ✅ Вывод блока "Мнение IzotovLife" с HTML-комментарием (izotov_comment) под текстом новости.
//
// Важно: остальная логика (related, share, canonical, метрики и т.п.) не изменена.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import DOMPurify from "dompurify";
import { Helmet } from "react-helmet-async";

import s from "./NewsDetailPage.module.css";
import sk from "./NewsDetailPageSkeleton.module.css";
import anim from "./NewsDetailPageAnim.module.css";

import {
  fetchRelated,
  fetchArticle,
  fetchNews,
  hitMetrics,
  fetchCategories,
  fetchCategoryNews,
  API_BASE as API_BASE_FROM_API,
  buildThumb as buildThumbFromApi,
} from "../Api";

import ArticleBody from "../components/ArticleBody";
import { buildPrettyTitle } from "../utils/title";

import { FiExternalLink, FiClock, FiLink, FiEye } from "react-icons/fi";
import { FaVk, FaTelegramPlane, FaWhatsapp, FaOdnoklassniki } from "react-icons/fa";

import useScrollToNewsTop from "../hooks/useScrollToNewsTop";

import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
});


const HIDE_UI_BREADCRUMBS = true;

// ================= НАСТРОЙКИ API (с фолбэком) =================

function getPageOrigin() {
  try {
    if (typeof window !== "undefined" && window.location && window.location.origin) {
      return window.location.origin;
    }
  } catch {}
  return "";
}

function stripTrackingParams(urlStr) {
  if (!urlStr) return "";
  try {
    const origin = getPageOrigin() || "https://izotovlife.ru";
    const u = new URL(String(urlStr), origin);
    u.hash = "";
    const drop = new Set([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "yclid",
      "igshid",
      "mc_cid",
      "mc_eid",
    ]);
    for (const k of Array.from(u.searchParams.keys())) {
      if (drop.has(k)) u.searchParams.delete(k);
      if (/^utm_/i.test(k)) u.searchParams.delete(k);
    }
    if ([...u.searchParams.keys()].length === 0) u.search = "";
    return u.href;
  } catch {
    return String(urlStr);
  }
}

function normalizeApiBase(v) {
  const origin = getPageOrigin();
  const s = (v || "").toString().trim();
  if (!s) return origin ? `${origin}/api` : "http://127.0.0.1:8000/api";
  if (origin && s.startsWith("/")) return `${origin}${s}`;
  if (origin && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\b/i.test(s)) {
    return `${origin}/api`;
  }
  return s;
}

const API_BASE = normalizeApiBase(API_BASE_FROM_API).replace(/\/$/, "");
let BACKEND_ORIGIN = "http://127.0.0.1:8000";
try {
  BACKEND_ORIGIN = new URL(API_BASE).origin;
} catch {
  const origin = getPageOrigin();
  if (origin) BACKEND_ORIGIN = origin;
}

const RELATED_FIELDS =
  "id,slug,title,thumbnail,category_slug,category_name,published_at,seo_url,image,category";

// ================= УТИЛИТЫ FETCH/URL/THUMB =================

async function getJson(url, opts = {}) {
  try {
    const resp = await fetch(url, { credentials: "include", signal: opts.signal });
    if (!resp.ok) return null;
    const text = await resp.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function isHttpLike(u) {
  try {
    return /^https?:\/\//i.test(String(u));
  } catch {
    return false;
  }
}

function isDataOrBlob(u) {
  try {
    return /^(data:|blob:|about:)/i.test(String(u));
  } catch {
    return false;
  }
}

function upgradeHttpToHttpsSameHost(urlStr) {
  const origin = getPageOrigin();
  if (!origin) return urlStr;
  try {
    const page = new URL(origin);
    const u = new URL(urlStr, origin);
    if (page.protocol === "https:" && u.protocol === "http:" && u.host === page.host) {
      u.protocol = "https:";
      return u.href;
    }
    return u.href;
  } catch {
    return urlStr;
  }
}

function absoluteMedia(urlOrPath) {
  if (!urlOrPath) return null;
  if (isDataOrBlob(urlOrPath)) return String(urlOrPath);
  try {
    if (isHttpLike(urlOrPath)) {
      const fixed = upgradeHttpToHttpsSameHost(new URL(String(urlOrPath)).href);
      return fixed;
    }
  } catch {}
  const p = String(urlOrPath).startsWith("/") ? String(urlOrPath) : `/${String(urlOrPath)}`;
  const pageOrigin = getPageOrigin();
  const base = pageOrigin || BACKEND_ORIGIN;
  return upgradeHttpToHttpsSameHost(`${base}${p}`);
}

function rewriteLocalhostInResizerUrl(resizerUrl) {
  const origin = getPageOrigin() || BACKEND_ORIGIN;
  if (!origin) return resizerUrl || "";
  if (!resizerUrl) return "";
  try {
    const u = new URL(String(resizerUrl));
    const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\b/i.test(u.href);
    if (!isLocal) return upgradeHttpToHttpsSameHost(u.href);
    const fixed = new URL(u.pathname + u.search + u.hash, origin);
    return upgradeHttpToHttpsSameHost(fixed.href);
  } catch {
    try {
      const fixed = new URL(String(resizerUrl), origin);
      return upgradeHttpToHttpsSameHost(fixed.href);
    } catch {
      return resizerUrl;
    }
  }
}

function buildThumb(
  src,
  { w = 640, h = 360, fit = "cover", fmt = "webp", q = 82 } = {}
) {
  if (!src) return null;
  if (isDataOrBlob(src) || !isHttpLike(src)) return src;
  try {
    if (typeof buildThumbFromApi === "function") {
      const candidate = buildThumbFromApi(src, { w, h, fit, fmt, q }) || "";
      const fixed = rewriteLocalhostInResizerUrl(candidate);
      if (fixed) return fixed;
    }
  } catch {}
  const params = new URLSearchParams({
    src: String(src),
    w: String(w),
    h: String(h),
    fit,
    fmt,
    q: String(q),
  });
  const raw = `${API_BASE}/media/thumbnail/?${params.toString()}`;
  return rewriteLocalhostInResizerUrl(raw);
}

function normalizeRelated(items) {
  if (!Array.isArray(items)) return [];
  return items.map((it) => {
    const imageAbs = it?.image ? absoluteMedia(it.image) : it?.imageAbs || null;
    const thumb = imageAbs
      ? buildThumb(imageAbs, { w: 640, h: 360, fit: "cover", fmt: "webp", q: 82 })
      : null;
    return { ...it, imageAbs, thumb };
  });
}

// ================= Заголовок + подзаголовок =================

function splitTitleSubtitle(rawTitle) {
  const input = (rawTitle ?? "").toString();
  const normalized = input
    .replace(/\r\n/gi, "\n")
    .replace(/\r/gi, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return { title: "", subtitle: "" };

  const parts = normalized
    .split(/\n+/g)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return { title: parts[0], subtitle: parts.slice(1).join(" ") };
  }

  const m = normalized.match(/^(.{8,160}?)\s*(?:\u2014|\u2013|-)\s+(.{12,220})$/u);
  if (m) {
    const left = (m[1] || "").trim();
    const right = (m[2] || "").trim();
    const leftWords = left.split(/\s+/).filter(Boolean);
    if (leftWords.length < 2 || left.length < 14) {
      return { title: normalized.replace(/\s+/g, " ").trim(), subtitle: "" };
    }
    if (!right || right.length < 12) {
      return { title: normalized.replace(/\s+/g, " ").trim(), subtitle: "" };
    }
    return { title: left, subtitle: right };
  }

  return { title: normalized.replace(/\s+/g, " ").trim(), subtitle: "" };
}

function cleanOneLineTitle(v) {
  return (v ?? "")
    .toString()
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fixTitleDashes(text) {
  return String(text ?? "").replace(/\s+([—–-])\s+/g, "\u00A0$1\u00A0");
}

// ================= БЕЗОПАСНЫЙ ТЕКСТ =================

function getName(val) {
  if (val == null) return "";
  const t = typeof val;
  if (t === "string" || t === "number" || t === "boolean" || t === "bigint") return String(val);
  if (Array.isArray(val)) return val.map(getName).filter(Boolean).join(", ");
  if (t === "object") return String(val.name ?? val.title ?? val.label ?? val.slug ?? "");
  return String(val);
}

// ================= SEO: description =================

function makeNewsDescription(news, maxLen = 170) {
  if (!news || typeof news !== "object") return "";
  const candidates = [
    news.seo_description, // НОВОЕ: ручное описание имеет приоритет
    news.description,
    news.lead,
    news.short_text,
    news.summary,
    news.content,
  ].filter(Boolean);
  if (!candidates.length) return "";
  const raw = String(candidates[0])
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return "";
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, maxLen).replace(/[\s.,!?:;\-—–]+$/u, "") + "…";
}

// ================= Быстрые похожие/категория =================

async function fetchCategoryLatest(catSlug, limit = 8) {
  try {
    const res = await fetchCategoryNews(catSlug, 1, limit);
    const arr = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
    return normalizeRelated(arr).slice(0, limit);
  } catch {
    return [];
  }
}

async function fetchArticleUniversal(slug) {
  if (!slug) return null;
  try {
    return await getJson(`${API_BASE}/news/${encodeURIComponent(slug)}/`);
  } catch {
    return null;
  }
}

// ================= Похожие: несколько вариантов =================

function withTimeout(promise, ms = 1200) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

async function fetchJsonArray(url, timeoutMs = 1200, signal) {
  try {
    const d = await withTimeout(getJson(url, { signal }), timeoutMs);
    const arr = Array.isArray(d?.items)
      ? d.items
      : Array.isArray(d?.results)
      ? d.results
      : Array.isArray(d)
      ? d
      : [];
    return normalizeRelated(arr);
  } catch {
    return [];
  }
}

async function fetchRelatedVariantsFast(slug, categorySlug, limit = 8, signal) {
  if (!slug) return [];
  const p1 = fetchJsonArray(
    `${API_BASE}/news/related/${encodeURIComponent(slug)}/?limit=${limit}&fields=${encodeURIComponent(
      RELATED_FIELDS
    )}`,
    1500,
    signal
  );
  const p2 = fetchJsonArray(
    `${API_BASE}/news/${encodeURIComponent(slug)}/related/?limit=${limit}&fields=${encodeURIComponent(
      RELATED_FIELDS
    )}`,
    1500,
    signal
  );
  const p3 = (async () => {
    try {
      const viaNew = await withTimeout(
        (async () => {
          const res = await fetchRelated({ slug, limit, fields: RELATED_FIELDS });
          if (Array.isArray(res?.results)) return normalizeRelated(res.results);
          if (Array.isArray(res)) return normalizeRelated(res);
          return [];
        })(),
        1500
      );
      if (viaNew?.length) return viaNew;
    } catch {}
    try {
      const legacy = await withTimeout(
        (async () =>
          normalizeRelated((await fetchRelated("article", categorySlug || "news", slug)) || []))(),
        1500
      );
      return legacy;
    } catch {
      return [];
    }
  })();
  const p4 = fetchCategoryLatest(categorySlug || "news", limit);

  if (typeof Promise.any === "function") {
    try {
      const first = await Promise.any([
        p1.then((a) => (a?.length ? a : Promise.reject())),
        p2.then((a) => (a?.length ? a : Promise.reject())),
        p3.then((a) => (a?.length ? a : Promise.reject())),
        p4.then((a) => (a?.length ? a : Promise.reject())),
      ]);
      return first.slice(0, limit);
    } catch {
      const [a1, a2, a3, a4] = await Promise.all([p1, p2, p3, p4]);
      const best = [a1, a2, a3, a4].find((a) => a?.length) || [];
      return best.slice(0, limit);
    }
  } else {
    const [a1, a2, a3, a4] = await Promise.allSettled([p1, p2, p3, p4]);
    const pick = (...r) =>
      r
        .map((x) => (x.status === "fulfilled" ? x.value : []))
        .find((a) => a?.length) || [];
    return pick(a1, a2, a3, a4).slice(0, limit);
  }
}

// ================= Кеш похожих =================

const RELATED_CACHE_TTL = 5 * 60 * 1000;
const relatedCache = new Map();

function ssGet(slug) {
  try {
    const raw = sessionStorage.getItem(`related:${slug}`);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.ts || !Array.isArray(obj.items)) return null;
    if (Date.now() - obj.ts > RELATED_CACHE_TTL) return null;
    return obj.items;
  } catch {
    return null;
  }
}

function ssSet(slug, items) {
  try {
    sessionStorage.setItem(`related:${slug}`, JSON.stringify({ ts: Date.now(), items }));
  } catch {}
}

function getCachedRelated(slug) {
  const mem = relatedCache.get(slug);
  if (mem && Date.now() - mem.ts <= RELATED_CACHE_TTL) return mem.items;
  return ssGet(slug);
}

function setCachedRelated(slug, items) {
  relatedCache.set(slug, { ts: Date.now(), items });
  ssSet(slug, items);
}

// ================= Даты =================

function formatRuPortalDate(isoString, tz = "Europe/Moscow") {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return String(isoString);
    const fmt = new Intl.DateTimeFormat("ru-RU", {
      timeZone: tz,
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = {};
    for (const p of fmt.formatToParts(d)) if (p.type !== "literal") parts[p.type] = p.value;
    return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
  } catch {
    return String(isoString);
  }
}

function isLikelyISO(v) {
  if (!v) return false;
  const s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}T/.test(s) || /^\d{4}-\d{2}-\d{2}\s/.test(s);
}

function humanizeSlug(slug) {
  if (!slug) return "";
  const map = {
    "bez-kategorii": "Без категории",
    "lenta-novostej": "Лента новостей",
    "v-mire": "В мире",
    "v-rossii": "В России",
    "armija-i-opk": "Армия и ОПК",
    "byvshij-sssr": "Бывший СССР",
    "silovye-struktury": "Силовые структуры",
    "nauka-i-tehnika": "Наука и техника",
  };
  if (map[slug]) return map[slug];
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function extractSlug(maybeUrl) {
  if (!maybeUrl) return "";
  try {
    const u = new URL(maybeUrl, BACKEND_ORIGIN);
    const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  } catch {
    const parts = String(maybeUrl).replace(/\/+$/, "").split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }
}

function filterOutCurrent(list, curSlug, curId) {
  const curSlugLC = (curSlug || "").toLowerCase();
  const curIdStr = curId != null ? String(curId) : null;
  return (Array.isArray(list) ? list : []).filter((n) => {
    const nid = n?.id ?? n?.pk ?? null;
    if (curIdStr && nid != null && String(nid) === curIdStr) return false;
    const nSlug = (n?.slug || n?.news_slug || extractSlug(n?.seo_url) || "").toLowerCase();
    return !(curSlugLC && nSlug && nSlug === curSlugLC);
  });
}

// ================= Авторские материалы: детект + крошки =================

const AUTHOR_CATEGORY_SLUG = "avtorskie-materialy";
const AUTHOR_CATEGORY_TITLE = "Авторские материалы";

function isAuthorMaterialByItemOrLocation(item) {
  try {
    const seo = String(item?.seo_url || "");
    if (seo.includes("/articles/")) return true;
    if (seo.includes("/avtorskie-materialy/")) return true;
  } catch {}
  try {
    const cslug = String(item?.category?.slug || "");
    if (cslug === AUTHOR_CATEGORY_SLUG) return true;
  } catch {}
  try {
    if (typeof window !== "undefined" && window.location) {
      const path = String(window.location.pathname || "");
      if (path.startsWith("/articles/")) return true;
      if (path.startsWith("/avtorskie-materialy/")) return true;
    }
  } catch {}
  try {
    const externalUrl = item?.original_url || item?.link || item?.url || null;
    const hasSource =
      item?.source_title ||
      item?.source_name ||
      item?.source_domain ||
      item?.domain ||
      item?.host ||
      (item?.source && (item.source.title || item.source.name || item.source.url)) ||
      null;
    if (!externalUrl && !hasSource) return true;
  } catch {}
  return false;
}

function pickAuthorUsernameFromItemOrUrl(item) {
  try {
    const a = item?.author || item?.user || item?.owner || item?.creator || null;
    if (a) {
      const u = String(
        a.username || a.login || a.slug || a.user_name || ""
      ).trim();
      if (u) return u;
    }
  } catch {}
  try {
    const flat = String(
      item?.author_username ||
        item?.author_login ||
        item?.author_slug ||
        item?.username ||
        item?.user_username ||
        item?.user_login ||
        item?.user_slug ||
        item?.owner_username ||
        item?.creator_username ||
        ""
    ).trim();
    if (flat) return flat;
  } catch {}
  try {
    const seo = String(item?.seo_url || "").trim();
    if (seo.includes("/articles/")) {
      const u = new URL(seo, getPageOrigin() || BACKEND_ORIGIN);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "articles" && parts[1]) return String(parts[1]).trim();
    }
  } catch {}
  try {
    if (typeof window !== "undefined" && window.location) {
      const path = String(window.location.pathname || "");
      if (path.startsWith("/articles/")) {
        const parts = path.split("/").filter(Boolean);
        if (parts[0] === "articles" && parts[1]) return String(parts[1]).trim();
      }
    }
  } catch {}
  return "";
}

function pickAuthorTitleFromItem(item) {
  try {
    const a = item?.author || item?.user || item?.owner || item?.creator || null;
    if (a) {
      const fn = String(a.first_name || "").trim();
      const ln = String(a.last_name || "").trim();
      const full = [fn, ln].filter(Boolean).join(" ").trim();
      if (full) return full;
      const dn = String(a.display_name || a.name || a.title || "").trim();
      if (dn) return dn;
      const u = String(a.username || a.login || a.slug || "").trim();
      if (u) return u;
    }
  } catch {}
  try {
    const flat = String(
      item?.author_name ||
        item?.author_full_name ||
        item?.author_display_name ||
        item?.author_title ||
        ""
    ).trim();
    if (flat) return flat;
  } catch {}
  return "";
}

function pickAuthorBreadcrumb(item) {
  const username = pickAuthorUsernameFromItemOrUrl(item);
  const title = pickAuthorTitleFromItem(item) || username;
  if (!username && !title) return null;
  return { username: username || "", title: title || "Автор" };
}

// ================= Источник =================

function extractDomainHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function pickSourceFromItem(item) {
  if (!item || typeof item !== "object") return null;
  const sourceTitle =
    item.source_title ||
    item.source_name ||
    (item.source && (item.source.title || item.source.name)) ||
    item.site_name ||
    item.source_domain ||
    item.domain ||
    item.host ||
    null;
  const sourceUrl =
    item.original_url ||
    item.link ||
    item.url ||
    item.source_url ||
    item.source_link ||
    item.source_href ||
    (item.source &&
      (item.source.url || item.source.homepage || item.source.link || item.source.href)) ||
    null;
  if (!sourceTitle && !sourceUrl) return null;
  const domain = sourceUrl ? extractDomainHost(sourceUrl) : "";
  const title = (sourceTitle || "").toString().trim() || domain;
  if (!title) return null;
  const logoPriority =
    item.source_logo ||
    item.source_logo_url ||
    (item.source_fk && (item.source_fk.logo || item.source_fk.icon)) ||
    (item.source && item.source.logo) ||
    null;
  const favicon = domain
    ? `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(
        "https://" + domain
      )}`
    : null;
  return { title, url: sourceUrl, icon: logoPriority || favicon || null };
}

function MetaInfo({ datePretty, dateIso, item, viewsCount }) {
  const hasDate = !!(datePretty && /\d/.test(String(datePretty)));
  const info = pickSourceFromItem(item);
  return (
    <div className={s.metaRow}>
      {hasDate ? (
        <span className={`${s.metaPill} ${s.metaPillTime}`} title={dateIso || undefined}>
          <FiClock className={s.metaIcon} aria-hidden="true" />
          <time dateTime={dateIso || undefined}>{datePretty}</time>
        </span>
      ) : null}
      {typeof viewsCount === "number" ? (
        <span className={`${s.metaPill} ${s.metaPillTime}`} title="">
          <FiEye className={s.metaIcon} aria-hidden="true" />
          <span>{viewsCount.toLocaleString("ru-RU")}</span>
        </span>
      ) : null}
      {info ? (
        info.url ? (
          <a
            className={`${s.metaPill} ${s.metaPillSource} ${s.metaSourceLink}`}
            href={info.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {info.icon ? (
              <img className={s.metaFav} src={info.icon} alt="" width={16} height={16} />
            ) : null}
            <span className={s.sourceDot} aria-hidden="true" />
            <span className={s.metaSourceLabel}>&nbsp;</span>
            <span className={s.metaSourceName}>{info.title}</span>
            <FiExternalLink className={s.metaIcon} aria-hidden="true" />
          </a>
        ) : (
          <span className={`${s.metaPill} ${s.metaPillSource}`} aria-label={info.title}>
            {info.icon ? (
              <img className={s.metaFav} src={info.icon} alt="" width={16} height={16} />
            ) : null}
            <span className={s.sourceDot} aria-hidden="true" />
            <span className={s.metaSourceLabel}>&nbsp;</span>
            <span className={s.metaSourceName}>{info.title}</span>
          </span>
        )
      ) : null}
    </div>
  );
}

// ================= Шаринг =================

function ShareButtons({ title, id, shareUrlOverride, label = "" }) {
  const [copied, setCopied] = useState(false);
  const [maxHint, setMaxHint] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const href = typeof window !== "undefined" ? window.location.href : "";
  const rawText = title || (typeof document !== "undefined" ? document.title : "");
  const override = stripTrackingParams(shareUrlOverride);

  const shareHref =
    override ||
    (origin && id != null && String(id).trim()
      ? `${origin}/share/${id}`
      : stripTrackingParams(href));

  const url = encodeURIComponent(shareHref || "");
  const text = encodeURIComponent(rawText || "IzotovLife");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareHref);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async function shareMax() {
    setMaxHint("");
    const shareUrl = shareHref;
    const shareText = rawText || "IzotovLife";

    try {
      if (
        typeof window !== "undefined" &&
        window.WebApp &&
        typeof window.WebApp.shareContent === "function"
      ) {
        window.WebApp.shareContent(shareText, shareUrl);
        return;
      }
    } catch {}

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: shareText, text: shareText, url: shareUrl });
        return;
      }
    } catch {}

    const ok = await copyLink();
    if (ok) {
      setMaxHint("Ссылка скопирована");
      setTimeout(() => setMaxHint(""), 2200);
    }
  }

  return (
    <div className={s.shareBlock}>
      <div className={s.shareLabel}>{label}</div>

      <div className={s.socialAuthButtons}>
        <a
          className={s.socialAuthButton}
          href={`https://vk.com/share.php?url=${url}&title=${text}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Поделиться во VK"
        >
          <FaVk aria-hidden="true" />
        </a>

        <a
          className={s.socialAuthButton}
          href={`https://connect.ok.ru/offer?url=${url}&title=${text}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Поделиться в OK"
        >
          <FaOdnoklassniki aria-hidden="true" />
        </a>

        <a
          className={s.socialAuthButton}
          href={`https://t.me/share/url?url=${url}&text=${text}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Поделиться в Telegram"
        >
          <FaTelegramPlane aria-hidden="true" />
        </a>

        <a
          className={s.socialAuthButton}
          href={`https://api.whatsapp.com/send?text=${text}%20${url}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Поделиться в WhatsApp"
        >
          <FaWhatsapp aria-hidden="true" />
        </a>

        <button
          className={s.socialAuthButton}
          type="button"
          onClick={shareMax}
          title="Поделиться (MAX)"
        >
          <span className={s.shareMaxText}>MAX</span>
        </button>

        <button
          className={s.socialAuthButton}
          type="button"
          onClick={copyLink}
          title={copied ? "Скопировано!" : "Скопировать ссылку"}
        >
          <FiLink aria-hidden="true" />
        </button>
      </div>

      {maxHint ? <div className={s.shareHint}>{maxHint}</div> : null}
    </div>
  );
}



// ================= IzotovLife: обсуждение (соц-вход) =================

function IzotovDiscuss({ item }) {
  const rawIzotov = item?.izotov_comment ?? "";
  const hasIzotov = !!String(rawIzotov || "").trim();

  const nextPath = useMemo(() => {
    try {
      if (typeof window === "undefined" || !window.location) return "/";
      return String(window.location.pathname || "/") + String(window.location.search || "");
    } catch {
      return "/";
    }
  }, []);

  const loginUrls = useMemo(() => {
    const baseOrigin = BACKEND_ORIGIN || getPageOrigin() || "";
    const mk = (path) => `${baseOrigin}${path}?next=${encodeURIComponent(nextPath)}`;
    return {
      vk: mk("/accounts/vk/login/"),
      ok: mk("/accounts/odnoklassniki/login/"),
      tg: mk("/accounts/telegram/login/"),
    };
  }, [nextPath]);

  if (!hasIzotov) return null;

  return (
    <div className={s.izotovCommentDiscuss}>
      <div className={s.socialAuthBlock}>
        <div className={s.socialAuthTitle}>Комментировать мнение IzotovLife</div>
        <div className={s.muted}>
          Войдите через соцсеть — аккаунт создастся автоматически, и вы сможете оставлять комментарии.
        </div>
        <div className={s.socialAuthButtons}>
          <a className={s.socialAuthButton} href={loginUrls.vk} title="Войти через VK">
            <FaVk aria-hidden="true" />
          </a>
          <a className={s.socialAuthButton} href={loginUrls.ok} title="Войти через OK">
            <FaOdnoklassniki aria-hidden="true" />
          </a>
          <a className={s.socialAuthButton} href={loginUrls.tg} title="Войти через Telegram">
            <FaTelegramPlane aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ================= Скелетон =================

function MainSkeleton() {
  const bar = (w, h) => ({
    height: h,
    width: w,
    borderRadius: 10,
    background: "rgba(255,255,255,0.08)",
  });
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={bar("70%", 26)} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={bar(140, 18)} />
        <div style={bar(220, 18)} />
      </div>
      <div style={bar("55%", 16)} />
      <div
        style={{
          width: "100%",
          height: 280,
          borderRadius: 14,
          background: "rgba(255,255,255,0.06)",
        }}
      />
      <div style={bar("95%", 14)} />
      <div style={bar("92%", 14)} />
      <div style={bar("88%", 14)} />
      <div style={bar("76%", 14)} />
    </div>
  );
}

function extractItemCategorySlugSafe(item) {
  if (!item || typeof item !== "object") return null;
  try {
    const c1 = item?.category?.slug;
    if (c1) return String(c1);
  } catch {}
  try {
    const c2 = item?.category_slug;
    if (c2) return String(c2);
  } catch {}
  try {
    const c3 = item?.category;
    if (typeof c3 === "string") return c3.trim();
  } catch {}
  return null;
}

// ================= ОСНОВНОЙ КОМПОНЕНТ =================

export default function NewsDetailPage() {
  const params = useParams();
  const slug = useMemo(() => {
    if (params?.slug) return params.slug;
    if (params?.importedSlug) return params.importedSlug;
    if (params?.slugOrId) return params.slugOrId;
    try {
      const vals = Object.values(params).filter(Boolean);
      return vals[vals.length - 1] || null;
    } catch {
      return null;
    }
  }, [params]);

  const categoryParamSafe = params?.category || "news";

  useScrollToNewsTop(slug, { anchorId: "news-detail-top", behavior: "smooth" });

  const [item, setItem] = useState(null);
  const [itemLoading, setItemLoading] = useState(true);
  const [viewsCount, setViewsCount] = useState(null);

  const [latest, setLatest] = useState([]);
  const [latestLoading, setLatestLoading] = useState(true);

  const [related, setRelated] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(true);

  const [error, setError] = useState(null);

  const [catDict, setCatDict] = useState({});
  const [showCover, setShowCover] = useState(true);

  const leftRef = useRef(null);
  const mainRef = useRef(null);
  const rightRef = useRef(null);
  const relSentinelRef = useRef(null);
  const latestSlugRef = useRef(null);
  const [relCanLoad, setRelCanLoad] = useState(true);

  const relatedFiltered = useMemo(() => {
    const curSlug = item?.slug || slug;
    const curId = item?.id ?? item?.pk ?? null;
    return filterOutCurrent(related, curSlug, curId);
  }, [related, item?.slug, item?.id, item?.pk, slug]);

  const preparedRelated = useMemo(() => {
    return relatedFiltered.map((n, idx) => {
      const img = n?.thumb || n?.imageAbs || (n?.image ? absoluteMedia(n.image) : null);
      return { ...n, img, hasImg: Boolean(img), idx };
    });
  }, [relatedFiltered]);

  const sortedRelated = useMemo(() => {
    const withImg = [];
    const withoutImg = [];
    for (const it of preparedRelated) {
      if (it.hasImg) withImg.push(it);
      else withoutImg.push(it);
    }
    withImg.sort((a, b) => a.idx - b.idx);
    withoutImg.sort((a, b) => a.idx - b.idx);
    return withImg.concat(withoutImg);
  }, [preparedRelated]);

  const titleParts = useMemo(
    () => splitTitleSubtitle(item?.title || ""),
    [item?.title]
  );
  const titleMainRaw = titleParts?.title;
  const titleSubtitleRaw = titleParts?.subtitle;

  const titleMain = cleanOneLineTitle(titleMainRaw || item?.title || "");
  const titleSubtitle = cleanOneLineTitle(titleSubtitleRaw || "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cats = await fetchCategories();
        if (!cancelled && Array.isArray(cats)) {
          const dict = {};
          for (const c of cats) {
            dict[c.slug] = c.name || c.title || humanizeSlug(c.slug);
          }
          setCatDict(dict);
        }
      } catch {
        // тихо игнорируем
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = BACKEND_ORIGIN;
    preconnect.crossOrigin = "";
    const dns = document.createElement("link");
    dns.rel = "dns-prefetch";
    dns.href = BACKEND_ORIGIN;
    document.head.append(preconnect, dns);
    return () => {
      try {
        document.head.removeChild(preconnect);
      } catch {}
      try {
        document.head.removeChild(dns);
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!relSentinelRef.current) return;
    let obs = null;
    const el = relSentinelRef.current;
    const handler = (entries) => {
      const e = entries[0];
      if (e && e.isIntersecting) {
        setRelCanLoad(true);
      }
    };
    obs = new IntersectionObserver(handler, {
      root: null,
      rootMargin: "160px 0px",
      threshold: 0.01,
    });
    obs.observe(el);
    return () => {
      if (obs) obs.disconnect();
    };
  }, []);

  const itemCategorySlugFromItem = useMemo(
    () => extractItemCategorySlugSafe(item),
    [item]
  );
  const effectiveCategorySlugForRelated =
    itemCategorySlugFromItem || categoryParamSafe || "news";

  useEffect(() => {
    if (!slug || !relCanLoad) return;
    let cancelled = false;
    const ac = new AbortController();
    latestSlugRef.current = slug;
    setRelated([]);
    setRelatedLoading(true);

    (async () => {
      const cachedRaw = getCachedRelated(slug);
      const cached = filterOutCurrent(cachedRaw, slug, null);
      if (cached?.length) {
        if (latestSlugRef.current === slug && !cancelled) {
          setRelated(cached);
          setRelatedLoading(false);
        }
      }

      try {
        if (!cached?.length) {
          const catFastRaw = await fetchCategoryLatest(effectiveCategorySlugForRelated, 8);
          const catFast = filterOutCurrent(catFastRaw, slug, null);
          if (!cancelled && latestSlugRef.current === slug && catFast.length) {
            setRelated(catFast);
            setRelatedLoading(false);
          }
        }
      } catch {}

      try {
        const listRaw = await fetchRelatedVariantsFast(
          slug,
          effectiveCategorySlugForRelated,
          8,
          ac.signal
        );
        const list = filterOutCurrent(listRaw, slug, null);
        if (cancelled || latestSlugRef.current !== slug) return;
        setCachedRelated(slug, list);
        setRelated(list);
      } finally {
        if (!cancelled && latestSlugRef.current === slug) {
          setRelatedLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [slug, effectiveCategorySlugForRelated, relCanLoad]);

  useEffect(() => {
    let cancelled = false;
    setItemLoading(true);
    setError(null);
    setShowCover(true);
    setViewsCount(null);
    setLatestLoading(true);

    (async () => {
      try {
        const lastRes = await fetchNews(1);
        if (!cancelled) setLatest(lastRes || []);
      } catch {
      } finally {
        if (!cancelled) setLatestLoading(false);
      }

      try {
        if (!slug) throw new Error("slug URL");
        const categoryParam = categoryParamSafe;
        let article = null;
        try {
          article = await fetchArticle(categoryParam, slug);
        } catch {}

        let universal = null;
        try {
          universal = await fetchArticleUniversal(slug);
        } catch {}

        if (!article && universal) {
          article = universal;
        } else if (article && universal) {
          const aCat = article?.category?.slug || article?.category_slug || (typeof article?.category === "string" ? article.category : "");
          const uCat = universal?.category?.slug || universal?.category_slug || (typeof universal?.category === "string" ? universal.category : "");
          const aSeo = String(article?.seo_url || "").trim();
          const uSeo = String(universal?.seo_url || "").trim();
          const articleLooksEmpty =
            (!aCat && !aSeo) ||
            (String(aCat || "").trim() === "news" &&
              String(uCat || "").trim() &&
              String(uCat || "").trim() !== "news");
          if (articleLooksEmpty) {
            article = { ...universal, ...article };
          } else {
            article = { ...article, ...universal };
          }
          if (uCat && !aCat && String(aCat || "").trim() === "news") {
            article.category = universal.category || article.category;
            article.category_slug = universal.category_slug || article.category_slug;
          }
          if (uSeo && !aSeo) {
            article.seo_url = universal.seo_url;
          }
        }

        if (!article) {
          try {
            article = await fetchArticle(categoryParam, slug);
          } catch {}
        }
        if (!article) {
          try {
            article = await fetchArticleUniversal(slug);
          } catch {}
        }
        if (cancelled) return;

        setItem(article || null);

        // Просмотры
        const slugForViews = article ? article.slug || slug : slug;
        if (!slugForViews) return;

        try {
          const d0 = await getJson(`${API_BASE}/news/${encodeURIComponent(slugForViews)}/views/`);
          if (!cancelled && d0 && d0.ok) {
            const v = Number(d0.views);
            setViewsCount(Number.isFinite(v) ? v : 0);
          }
        } catch {}

        let canHit = true;
        try {
          const key = `viewed:${slugForViews}`;
          if (typeof sessionStorage !== "undefined") {
            if (sessionStorage.getItem(key)) canHit = false;
            else sessionStorage.setItem(key, "1");
          }
        } catch {
          canHit = true;
        }
        if (!canHit) return;

        try {
          const resp = await fetch(
            `${API_BASE}/news/${encodeURIComponent(slugForViews)}/views/`,
            {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: "{}",
              keepalive: true,
            }
          );
          const d1 = (await resp.json().catch(() => null)) || null;
          if (!cancelled && d1 && d1.ok) {
            const v = Number(d1.views);
            setViewsCount(Number.isFinite(v) ? v : 0);
          }
        } catch {}

        try {
          const slugForMetrics = article ? article.slug || slug : slug;
          if (slugForMetrics) {
            hitMetrics(article, slugForMetrics).catch(() => {});
          }
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Не удалось загрузить новость");
        }
      } finally {
        if (!cancelled) {
          setItemLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, categoryParamSafe]);

  useEffect(() => {
    if (!mainRef.current || !leftRef.current || !rightRef.current) return;
    const syncHeights = () => {
      const isMobile = window.matchMedia("(max-width: 960px)").matches;
      if (isMobile) {
        if (leftRef.current) leftRef.current.style.height = "auto";
        if (rightRef.current) rightRef.current.style.height = "auto";
        return;
      }
      const h = mainRef.current ? mainRef.current.offsetHeight || 0 : 0;
      if (leftRef.current) leftRef.current.style.height = `${h}px`;
      if (rightRef.current) rightRef.current.style.height = `${h}px`;
    };
    const ro = new ResizeObserver(syncHeights);
    ro.observe(mainRef.current);
    window.addEventListener("resize", syncHeights);
    syncHeights();
    return () => {
      try {
        ro.disconnect();
      } catch {}
      window.removeEventListener("resize", syncHeights);
    };
  }, [item, latest, related, latestLoading, relatedLoading, itemLoading]);

  if (error) {
    return (
      <div className="news-detail">
        <div className={s.pageWrap}>
          <div className={s.main}>
            <div id="news-detail-top">
              <h1 className={s.title}>Ошибка</h1>
              <div className={s.body}>{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!slug) {
    return (
      <div className="news-detail">
        <div className={s.pageWrap}>
          <div className={s.main}>
            <div id="news-detail-top">
              <h1 className={s.title}>Новость не найдена</h1>
              <div className={s.body}>Некорректный URL.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (itemLoading) {
    return (
      <div className="news-detail">
        <div className={s.pageWrap}>
          <aside className={s.leftAside} ref={leftRef}>
            <div className={s.sectionH}>
              <div />
              <div className={sk.skelLatestCol} role="status" aria-label="Загрузка последних новостей">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div className={sk.skelLatestLine} key={`lt-skel-${i}`} />
                ))}
              </div>
            </div>
          </aside>
          <main className={s.main} ref={mainRef}>
            <div id="news-detail-top">
              <MainSkeleton />
            </div>
          </main>
          <aside className={s.rightAside} ref={rightRef}>
            <div className={s.sectionH}>
              <div />
              <div className={sk.skelGrid} role="status" aria-label="Загрузка похожих новостей">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div className={sk.skelRelItem} key={`rl-skel-${i}`}>
                    <div className={sk.skelThumb} />
                    <div className={sk.skelLines}>
                      <div className={sk.skelLine} />
                      <div className={sk.skelLineShort} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="news-detail">
        <div className={s.pageWrap}>
          <div className={s.main}>
            <div id="news-detail-top">
              <h1 className={s.title}>Новость не найдена</h1>
              <div className={s.body}>Страница не существует или была удалена.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const imageRaw =
    item.image ||
    item.cover_image ||
    item.cover ||
    item.image_url ||
    null;

  const externalUrl = item.original_url || item.link || item.url || item.external_url || null;

  const contentHtml = DOMPurify.sanitize(item.content || item.summary || "", {
    USE_PROFILES: { html: true },
  });

  const dateCandidate =
    (isLikelyISO(item.pubdate_fmt) && item.pubdate_fmt) ||
    item.pubdate_fmt ||
    item.published_at ||
    item.date ||
    item.created_at ||
    item.updated_at ||
    item.pubdate_fmt;

  const datePrettyRaw = dateCandidate ? formatRuPortalDate(dateCandidate, "Europe/Moscow") : "";
  const datePretty = /\d/.test(String(datePrettyRaw || "")) ? datePrettyRaw : "";
  const dateIso = isLikelyISO(dateCandidate)
    ? new Date(dateCandidate).toISOString()
    : null;

  const itemCategorySlug = extractItemCategorySlugSafe(item);
  const categorySlug = itemCategorySlug || categoryParamSafe || "news";
  const categoryTitle =
    item?.category?.name ||
    item?.category?.title ||
    (itemCategorySlug ? catDict[itemCategorySlug] : catDict[categorySlug]) ||
    humanizeSlug(categorySlug);

  const coverAbs = imageRaw ? absoluteMedia(imageRaw) : null;
  const coverUrl = coverAbs
    ? buildThumb(coverAbs, { w: 980, h: 520, q: 85, fmt: "webp", fit: "cover" })
    : null;

  // НОВОЕ: выбор SEO-заголовка
  const composedTitleForMeta =
    titleSubtitle ? `${titleMain} — ${titleSubtitle}` : titleMain;
  const metaTitle = item.seo_title && String(item.seo_title).trim()
    ? String(item.seo_title).trim()
    : buildPrettyTitle(composedTitleForMeta || item.title);

  // НОВОЕ: выбор SEO-описания
  const metaDescription = makeNewsDescription(item, 170);

  const slugSafe = item.slug || slug;
  const originForAbs = getPageOrigin() || "https://izotovlife.ru";
  const seoUrlRaw = item?.seo_url;
  const isSeoArticles = typeof seoUrlRaw === "string" && seoUrlRaw.includes("/articles/");
  const canonicalUrl = (() => {
    if (seoUrlRaw) {
      try {
        const u = new URL(String(seoUrlRaw), originForAbs);
        return stripTrackingParams(u.href);
      } catch {
        return stripTrackingParams(`${originForAbs}${seoUrlRaw}`);
      }
    }
    return stripTrackingParams(`https://izotovlife.ru/news/${slugSafe}`);
  })();

  const ogImage = coverUrl || null;

  const shareUrlOverride = (() => {
    try {
      if (typeof window === "undefined" || !window.location) return null;
      const path = window.location.pathname || "";
      const looksLikeAuthor = path.startsWith("/articles/") || isSeoArticles;
      if (!looksLikeAuthor) return null;
      return stripTrackingParams(window.location.href);
    } catch {
      return null;
    }
  })();

  const isAuthorMaterial = isAuthorMaterialByItemOrLocation(item);
  const breadcrumbSlug = isAuthorMaterial ? AUTHOR_CATEGORY_SLUG : itemCategorySlug || categorySlug;
  const breadcrumbTitle = isAuthorMaterial ? AUTHOR_CATEGORY_TITLE : categoryTitle;
  const breadcrumbUrl = `/${breadcrumbSlug}/`;

  const authorCrumb = isAuthorMaterial ? pickAuthorBreadcrumb(item) : null;
  const authorUrl = authorCrumb?.username ? `/author/${authorCrumb.username}/` : null;

  // НОВОЕ: блок комментария IzotovLife
  const hasIzotovComment =
  item.izotov_comment && String(item.izotov_comment).trim().length > 0;

const izotovCommentHtml = hasIzotovComment
  ? DOMPurify.sanitize(md.render(String(item.izotov_comment)), {
      USE_PROFILES: { html: true },
    })
  : "";


  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription || ""} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription || ""} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <div className="news-detail">
        <div className={s.pageWrap}>
          <aside className={s.leftAside} ref={leftRef}>
            <div className={s.sectionH}>
              <div />
              {latestLoading && latest.length === 0 ? (
                <div className={sk.skelLatestCol} role="status" aria-label="Загрузка последних новостей">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div className={sk.skelLatestLine} key={`lt-skel-${i}`} />
                  ))}
                </div>
              ) : (
                <div className={`${s.latestList} ${anim.fadeIn}`}>
                  {latest.map((n) => (
                    <Link
                      key={`l-${n.id}`}
                      to={n.seo_url || n.slug || "#"}
                      className={s.latestItem}
                    >
                      {buildPrettyTitle(n.title)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <main className={s.main} ref={mainRef}>
            <div id="news-detail-top">
              <h1 className={s.title}>
                {fixTitleDashes(buildPrettyTitle(titleMain || item.title))}
              </h1>
              {titleSubtitle ? (
                <div
                  style={{
                    marginTop: 10,
                    lineHeight: 1.25,
                    fontWeight: 700,
                    fontSize: "1.25rem",
                    opacity: 0.95,
                  }}
                >
                  {titleSubtitle}
                </div>
              ) : null}

              <nav className={s.breadcrumbsHidden} aria-label="Хлебные крошки">
  <Link to="/" style={{ textDecoration: "none" }}>
    <span>Главная</span>
  </Link>
  <span> · </span>
  <Link to={breadcrumbUrl} style={{ textDecoration: "none" }}>
    {breadcrumbTitle}
  </Link>
  {authorCrumb && authorUrl ? (
    <>
      <span> · </span>
      <Link to={authorUrl} style={{ textDecoration: "none" }}>
        {authorCrumb.title}
      </Link>
    </>
  ) : null}
  <span> · </span>
  <span>{buildPrettyTitle(titleMain || item.title)}</span>
</nav>

              <MetaInfo
                datePretty={datePretty}
                dateIso={dateIso}
                item={item}
                viewsCount={viewsCount}
              />
              {coverUrl && showCover ? (
                <img
                  src={coverUrl}
                  alt={titleMain || item.title}
                  className={s.cover}
                  onError={() => setShowCover(false)}
                />
              ) : null}

              <ArticleBody html={contentHtml} baseUrl={externalUrl} className={s.body} />

              {hasIzotovComment ? (
                <div className={s.izotovComment}>
                  <h2>Мнение IzotovLife</h2>
                  <ArticleBody
                    html={izotovCommentHtml}
                    baseUrl={externalUrl}
                  />
                  <IzotovDiscuss item={item} />
                </div>
              ) : null}

              <div className={s.external}>
                <div className={s.externalRow}>
                  <div className={s.externalLeft}>
                    {externalUrl ? (
                      <a
                        className={s.externalLink}
                        href={externalUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Перейти к источнику
                      </a>
                    ) : null}
                  </div>

                  <div className={s.externalRight}>
                    <ShareButtons
                      title={composedTitleForMeta || item?.title}
                      id={item?.id ?? item?.pk ?? null}
                      shareUrlOverride={shareUrlOverride}
                      label="Поделиться:"
                    />
                  </div>
                </div>
              </div>
            </div>
          </main>

          <aside className={s.rightAside} ref={rightRef}>
            <div ref={relSentinelRef} style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
            <div className={s.sectionH}>
              <div />
              {relatedLoading && sortedRelated.length === 0 ? (
                <div className={sk.skelGrid} role="status" aria-label="Загрузка похожих новостей">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div className={sk.skelRelItem} key={`rl-skel-${i}`}>
                      <div className={sk.skelThumb} />
                      <div className={sk.skelLines}>
                        <div className={sk.skelLine} />
                        <div className={sk.skelLineShort} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : sortedRelated.length > 0 ? (
                <div className={`${s.relList} ${anim.fadeIn}`}>
                  {sortedRelated.map((n) => {
                    const img = n.img;
                    const hasImg = Boolean(img);
                    return (
                      <Link
                        key={`r-${n.id}`}
                        to={n.seo_url || n.slug || "#"}
                        className={s.relItem}
                        style={
                          hasImg
                            ? {
                                display: "grid",
                                gridTemplateColumns: "84px 1fr",
                                gap: 12,
                                alignItems: "center",
                              }
                            : { display: "block" }
                        }
                      >
                        {hasImg ? (
                          <img
                            className={s.relThumb}
                            src={img}
                            alt=""
                            loading="lazy"
                            width={84}
                            height={84}
                            style={{
                              width: 84,
                              height: 84,
                              objectFit: "cover",
                              borderRadius: 8,
                            }}
                          />
                        ) : null}
                        <div style={{ width: "100%" }}>
                          <div className={s.relTitle}>{buildPrettyTitle(n.title)}</div>
                          <div className={s.relSource}>{n.source_title || getName(n.source)}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className={s.relEmpty}>Похожие новости не найдены.</div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
