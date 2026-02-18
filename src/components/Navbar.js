// Путь: frontend/src/components/Navbar.js
// Назначение: шапка IzotovLife (логотип, бегущая строка, поиск, категории, меню, кнопки).
//
// ОБНОВЛЕНИЕ (2026-01-02):
// ✅ Десктоп: категории по центру, пункт "Ещё" стоит рядом (не у края экрана)
// ✅ Мобильные/узкие экраны: показываем ТОЛЬКО категории, которые помещаются по ширине + "Ещё"
// ✅ Сортировка категорий: первыми идут самые большие по количеству новостей (через count API)
// ✅ Ничего из функций шапки не удалено: поиск, тикер, меню, "предложить новость", гороскоп, выпадающий список "Ещё" с обложками.
//
// FIX (2026-01-04B):
// ✅ Сжатие шапки срабатывает и при прокрутке внутри контейнера (#root), а не только window.scrollY.
// ✅ rAF + гистерезис, чтобы не мигало возле порога.
//
// FIX (2026-01-04C):
// ✅ Удалена случайно вставленная строка "t;" (ломала сборку ESLint).
//
// FIX (2026-01-04D):
// ✅ Убрали "залп" запросов, который приводил к 429 Too Many Requests (counts кеш/лимиты).
//
// FIX (2026-01-04E):
// ✅ Главная проблема: обрезается верх ленты/карточек из-за fixed navbar.
// ✅ Решение: Navbar измеряет свою высоту и пишет CSS-переменную --navbar-offset,
//    а глобальные стили дают body padding-top = --navbar-offset.
//
// FIX (2026-01-06):
// ✅ Бегущая строка (курсы+погода):
//    - двигается только если контент шире контейнера
//    - по клику плавно возвращается в начало
//    - после возврата стоит на паузе ~2 секунды
//
// FIX (2026-01-09):
// ✅ Тикер: разделитель стоит ТОЛЬКО в конце (|), и у него маленькие одинаковые отступы.
//
// FIX (2026-01-09-WHITE-THEME):
// ✅ Белая тема корректно применяется через классы/атрибуты (см. FIX 2026-02-15-LIGHT-ONLY ниже).
//
// ДОБАВЛЕНО (2026-02-06):
// ✅ FIX: категория "Авторские материалы" должна появляться в шапке всегда.
// ✅ Причина: на локалке реальный endpoint категорий: /api/categories/ (а /api/news/categories/ может отсутствовать).
// ✅ Решение:
//    1) Если fetchCategories() вернул пусто/ошибку — делаем fallback запрос на /api/categories/?page_size=200
//    2) Если в данных категория slug=avtorskie-materialy, но name англ. — заменяем UI name на "Авторские материалы"
//    3) Если такой категории нет вообще — добавляем "виртуальную" категорию (кнопка ведёт на /avtorskie-materialy/)
//    4) Для виртуальной категории не грузим counts и обложки (никаких лишних запросов / 404)
//
// FIX (2026-02-15-AUTHOR-ROUTE):
// ✅ Клики по "Авторские материалы" всегда ведут на /avtorskie-materialy/
//    (и в основной полосе, и в выпадающем "Ещё").
//
// FIX (2026-02-15-LIGHT-ONLY):
// ✅ Убрали переключатель темы из шапки.
// ✅ Зафиксировали только светлую тему (черный текст на белом фоне), без hotkeys и без переключения.
//
// FIX (2026-02-16-ADMIN-CABINET):
// ✅ Суперпользователь на фронте не видит "Личный кабинет автора" и не попадает в него.
// ✅ В боковом меню для суперпользователя показывается пункт "Админка", ведущий в /admin/.
// ✅ handlePersonalCabinet(): суперпользователь всегда уходит в Django admin, обычные роли — в свои кабинеты.
//
// FIX (2026-02-16-ADMIN-PREFERRED-FLAG):
// ✅ Если браузер помечен флагом admin_preferred=1 в localStorage,
//    любой клик по "Личный кабинет"/"Админка" ведёт в /admin/, даже если текущая Django-сессия гость.

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  whoami,
  setToken,
  goToAdmin,
  fetchCategories,
  isAdminPreferred,
  setAdminPreferred,
} from "../Api";

import {
  FaSearch,
  FaBars,
  FaTimes,
  FaChevronDown,
  FaNewspaper,
  FaLightbulb,
} from "react-icons/fa";

import SuggestNewsModal from "./SuggestNewsModal";
import WeatherWidget from "./WeatherWidget";
import CurrencyWidget from "./CurrencyWidget";
import SmartTicker from "./SmartTicker";
import SearchAutocomplete from "./search/SearchAutocomplete";
import "./Navbar.css";

const CAT_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="160"><rect width="100%" height="100%" fill="#0a0f1a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#5a6b84" font-family="Arial" font-size="14">Категория</text></svg>'
  );


// ✅ Виртуальная категория: показываем в шапке даже если бэк НЕ отдаёт её в /api/categories/
const STATIC_AUTHOR_CATEGORY = {
  slug: "avtorskie-materialy",
  name: "Авторские материалы",
  __static: true,
};

function looksLikeSlug(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (/[А-Яа-яЁё]/.test(s)) return false;
  return /^[a-z0-9-]+$/i.test(s);
}

function normalizeCategoryNameForUI(cat) {
  // ✅ Принудительно русифицируем имя категории авторских материалов
  // даже если в БД оно английское (Avtorskie Materialy)
  if (!cat || typeof cat !== "object") return cat;

  const slug = String(cat.slug || "").trim();
  if (slug !== "avtorskie-materialy") return cat;

  const name = String(cat.name || "").trim();
  if (!name || looksLikeSlug(name) || /avtorskie/i.test(name)) {
    return { ...cat, name: "Авторские материалы" };
  }

  // если name уже русский — оставляем
  return cat;
}

async function fetchCategoriesFallbackViaApi(signal) {
  // ✅ Реальный endpoint у тебя на локалке: /api/categories/
  // Возвращает {count,next,previous,results:[...]}
  const tryUrls = [
    "/api/categories/?page_size=200",
    "/api/categories/?page_size=500",
    "/api/categories/",
  ];

  for (const url of tryUrls) {
    try {
      const resp = await fetch(url, { credentials: "same-origin", signal });
      if (!resp.ok) continue;
      const raw = await resp.json().catch(() => null);

      const cats = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.results)
          ? raw.results
          : [];

      if (cats.length) return cats;
    } catch {
      // ignore and try next
    }
  }

  return [];
}

/** =========================
 *  Anti-429 helpers (counts)
 *  ========================= */
const COUNTS_CACHE_KEY = "izotovlife_category_counts_v1";
const COUNTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 часов
const COUNTS_MAX_FETCH_PER_BOOT = 12; // не больше 12 догрузок counts за один запуск страницы
const COUNTS_POOL_LIMIT = 2; // меньше параллельности
const COUNTS_REQUEST_DELAY_MS = 120; // микропаузa между запросами (смягчает rate limit)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readCountsCache() {
  try {
    const raw = localStorage.getItem(COUNTS_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const ts = Number(parsed.ts || 0);
    if (!ts || Date.now() - ts > COUNTS_CACHE_TTL_MS) return {};
    const data = parsed.data;
    if (!data || typeof data !== "object") return {};
    return data;
  } catch {
    return {};
  }
}

function writeCountsCache(nextMap) {
  try {
    localStorage.setItem(
      COUNTS_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), data: nextMap || {} })
    );
  } catch {
    // ignore
  }
}

const pickImageUrl = (obj) => {
  if (!obj || typeof obj !== "object") return null;

  const KEYS = [
    "image",
    "image_url",
    "thumbnail",
    "cover_image",
    "cover",
    "top_image",
    "top_image_url",
    "hero_image",
    "main_image",
    "photo",
    "picture",
    "img",
  ];

  for (const key of KEYS) {
    const val = obj[key];

    if (typeof val === "string" && val.trim().length > 0) return val.trim();

    if (val && typeof val === "object") {
      if (typeof val.url === "string" && val.url.trim().length > 0) return val.url.trim();
      if (typeof val.src === "string" && val.src.trim().length > 0) return val.src.trim();
    }
  }

  return null;
};

const extractNewsItems = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.data)) return data.data;
  if (data.data && Array.isArray(data.data.results)) return data.data.results;
  if (Array.isArray(data.items)) return data.items;

  const values = Object.values(data);
  for (const v of values) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      const nested = extractNewsItems(v);
      if (nested.length) return nested;
    }
  }
  return [];
};

const normalizeImgUrl = (url) => {
  if (!url) return url;
  const s = String(url).trim();
  if (!s) return s;
  if (s.startsWith("http://")) return "https://" + s.slice("http://".length);
  return s;
};

const getCategoryImageUrl = (cat, thumbsMap) => {
  if (!cat) return CAT_FALLBACK;
  if (thumbsMap && thumbsMap[cat.slug]) return thumbsMap[cat.slug];
  const url = pickImageUrl(cat);
  return normalizeImgUrl(url) || CAT_FALLBACK;
};

const getInlineCountFromCategory = (cat) => {
  const candidates = [
    cat?.news_count,
    cat?.count,
    cat?.items_count,
    cat?.total,
    cat?.total_count,
  ];
  for (const v of candidates) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
};

async function fetchCategoryCount(slug, signal) {
  const url = `/api/news/category/${encodeURIComponent(slug)}/?page=1&page_size=1`;
  const resp = await fetch(url, { credentials: "same-origin", signal });

  if (resp.status === 429) return "THROTTLED";
  if (!resp.ok) return null;

  const raw = await resp.json();
  if (typeof raw?.count === "number" && Number.isFinite(raw.count)) return raw.count;

  const items = extractNewsItems(raw);
  if (Array.isArray(items)) return items.length;

  return null;
}

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let idx = 0;

  async function runner() {
    while (idx < items.length) {
      const current = idx++;
      try {
        results[current] = await worker(items[current], current);
      } catch {
        results[current] = null;
      }
    }
  }

  const runners = Array.from({ length: Math.max(1, limit) }, () => runner());
  await Promise.all(runners);
  return results;
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [openSuggest, setOpenSuggest] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const [categories, setCategories] = useState([]);
  const [categoryThumbs, setCategoryThumbs] = useState({});
  const [categoryCounts, setCategoryCounts] = useState({});

  const [isMobileCats, setIsMobileCats] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(max-width: 900px)").matches ?? false;
  });
  const [mobileVisibleCount, setMobileVisibleCount] = useState(4);

  const [isCollapsed, setIsCollapsed] = useState(false);

  // ✅ FIX 2026-01-11: определяем, "бежит" ли тикер (overflow) на маленьких экранах
  const [tickerOverflow, setTickerOverflow] = useState(false);

  const navigate = useNavigate();
  const popoverRef = useRef(null);

  const catsRowRef = useRef(null);
  const catsMeasureRef = useRef(null);
  const moreMeasureRef = useRef(null);

  const navbarRef = useRef(null);

  // ✅ refs для измерения overflow тикера
  const tickerViewportRef = useRef(null);
  const tickerInnerRef = useRef(null);

  // ✅ FIX 2026-02-15-AUTHOR-ROUTE: единый роут для категорий (особенно для авторских)
  const getCategoryPath = useCallback((cat) => {
    const slug = String(cat?.slug || "").trim();
    const name = String(cat?.name || "").trim().toLowerCase();

    // Жёстко фиксируем URL авторской категории, чтобы не улетать на / или /articles
    if (slug === "avtorskie-materialy") return "/avtorskie-materialy/";
    if (name === "авторские материалы") return "/avtorskie-materialy/";

    if (!slug) return "/";
    return `/${slug}/`;
  }, []);

  useEffect(() => {
    document.body.classList.add("has-navbar");
    return () => document.body.classList.remove("has-navbar");
  }, []);

  // FIX (2026-02-15-LIGHT-ONLY): фиксируем только светлую тему и убираем любые хвосты тем
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    const ALL_THEME_CLASSES = ["theme-graphite", "theme-white", "theme-light", "theme-dark"];
    body.classList.remove(...ALL_THEME_CLASSES);
    html.classList.remove(...ALL_THEME_CLASSES);

    body.classList.add("theme-white", "theme-light");
    html.classList.add("theme-white", "theme-light");

    html.setAttribute("data-theme", "light");
    body.setAttribute("data-theme", "light");

    localStorage.setItem("theme", "white");
  }, []);

  useEffect(() => {
    const el = navbarRef.current;
    if (!el) return;

    let rafId = 0;

    const apply = () => {
      rafId = 0;
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) {
        document.documentElement.style.setProperty("--navbar-offset", `${h}px`);
      }
    };

    const schedule = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(apply);
    };

    schedule();

    let ro;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => schedule());
      ro.observe(el);
    }

    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("resize", schedule);
      if (ro) ro.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      const v = window.matchMedia?.("(max-width: 900px)").matches ?? false;
      setIsMobileCats(v);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ✅ FIX 2026-01-11: измеряем, шире ли контент тикера, чем контейнер (overflow => "бежит")
  useEffect(() => {
    const vp = tickerViewportRef.current;
    const inner = tickerInnerRef.current;
    if (!vp || !inner) return;

    let rafId = 0;

    const compute = () => {
      rafId = 0;
      try {
        const vpW = Math.ceil(vp.getBoundingClientRect().width || 0);
        const innerW = Math.ceil(inner.scrollWidth || 0);
        const overflow = innerW > vpW + 2; // небольшой допуск
        setTickerOverflow(overflow);
      } catch {
        // ignore
      }
    };

    const schedule = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(compute);
    };

    schedule();

    let ro;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => schedule());
      ro.observe(vp);
      ro.observe(inner);
    }

    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("resize", schedule);
      if (ro) ro.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadCategories() {
      try {
        // 1) Пробуем как раньше (через общий Api.js)
        let cats = [];
        try {
          const resp = await fetchCategories();
          cats = Array.isArray(resp)
            ? resp
            : Array.isArray(resp?.results)
              ? resp.results
              : [];
        } catch {
          cats = [];
        }

        // 2) Если пусто — делаем fallback на реальный endpoint /api/categories/
        if (!cats || cats.length === 0) {
          const fallback = await fetchCategoriesFallbackViaApi(controller.signal);
          cats = fallback || [];
        }

        if (cancelled) return;

        // 3) Нормализуем UI-name для авторской категории, если она пришла англ.
        const normalized = (cats || []).map((c) => normalizeCategoryNameForUI(c));

        // 4) Если author категории нет вообще — подмешиваем виртуальную
        const hasAuthor = normalized.some(
          (c) => String(c?.slug || "").trim() === "avtorskie-materialy"
        );
        const finalCats = hasAuthor ? normalized : [...normalized, STATIC_AUTHOR_CATEGORY];

        setCategories(finalCats);
      } catch (e) {
        console.error("Ошибка загрузки категорий:", e);

        // даже при ошибке — покажем хотя бы авторскую категорию
        if (!cancelled) setCategories([STATIC_AUTHOR_CATEGORY]);
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
      try {
        controller.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (!categories || categories.length === 0) return;

    let cancelled = false;
    const controller = new AbortController();

    async function loadCounts() {
      const cache = readCountsCache();
      const updates = {};
      let cacheTouched = false;

      for (const c of categories) {
        if (!c?.slug) continue;
        if (c.__static) continue; // ✅ не грузим counts для виртуальной категории

        const inline = getInlineCountFromCategory(c);
        if (inline !== null) {
          updates[c.slug] = inline;
          if (cache[c.slug] !== inline) {
            cache[c.slug] = inline;
            cacheTouched = true;
          }
        }
      }

      for (const c of categories) {
        if (!c?.slug) continue;
        if (c.__static) continue; // ✅ не грузим counts для виртуальной категории
        if (updates[c.slug] !== undefined) continue;

        const cached = cache[c.slug];
        if (typeof cached === "number" && Number.isFinite(cached)) {
          updates[c.slug] = cached;
        }
      }

      const need = categories
        .filter((c) => c?.slug && !c.__static) // ✅
        .map((c) => c.slug)
        .filter((slug) => updates[slug] === undefined);

      const needLimited = need.slice(0, COUNTS_MAX_FETCH_PER_BOOT);

      if (needLimited.length > 0) {
        let throttled = false;

        const fetched = await runPool(needLimited, COUNTS_POOL_LIMIT, async (slug) => {
          if (throttled) return null;
          await sleep(COUNTS_REQUEST_DELAY_MS);

          const cnt = await fetchCategoryCount(slug, controller.signal);
          if (cnt === "THROTTLED") {
            throttled = true;
            return { slug, cnt: null, throttled: true };
          }
          return { slug, cnt };
        });

        for (const row of fetched) {
          if (!row) continue;

          if (row.throttled) {
            console.warn(
              "429 Too Many Requests при догрузке counts категорий — остановили дальнейшие запросы."
            );
          }

          if (row.slug && typeof row.cnt === "number" && Number.isFinite(row.cnt)) {
            updates[row.slug] = row.cnt;
            cache[row.slug] = row.cnt;
            cacheTouched = true;
          }
        }
      }

      if (cacheTouched) writeCountsCache(cache);

      if (!cancelled && Object.keys(updates).length > 0) {
        setCategoryCounts((prev) => ({ ...prev, ...updates }));
      }
    }

    loadCounts();

    return () => {
      cancelled = true;
      try {
        controller.abort();
      } catch {
        // ignore
      }
    };
  }, [categories]);

  const sortedCategories = useMemo(() => {
    if (!categories || categories.length === 0) return [STATIC_AUTHOR_CATEGORY];

    const indexed = categories.map((c, i) => ({ c, i }));
    indexed.sort((a, b) => {
      const aSlug = String(a.c?.slug || "").trim();
      const bSlug = String(b.c?.slug || "").trim();

      // ✅ Авторские материалы — всегда повыше (чтобы не "терялись" в Ещё)
      const aIsAuthor = aSlug === "avtorskie-materialy";
      const bIsAuthor = bSlug === "avtorskie-materialy";
      if (aIsAuthor && !bIsAuthor) return -1;
      if (!aIsAuthor && bIsAuthor) return 1;

      const aCnt =
        a.c?.__static
          ? 0
          : aSlug && categoryCounts[aSlug] !== undefined
            ? Number(categoryCounts[aSlug])
            : getInlineCountFromCategory(a.c) ?? 0;

      const bCnt =
        b.c?.__static
          ? 0
          : bSlug && categoryCounts[bSlug] !== undefined
            ? Number(categoryCounts[bSlug])
            : getInlineCountFromCategory(b.c) ?? 0;

      if (bCnt !== aCnt) return bCnt - aCnt;
      return a.i - b.i;
    });

    return indexed.map((x) => x.c);
  }, [categories, categoryCounts]);

  const recomputeMobileVisibleCount = useCallback(() => {
    if (!isMobileCats) return;

    const rowEl = catsRowRef.current;
    const measEl = catsMeasureRef.current;
    const moreEl = moreMeasureRef.current;

    if (!rowEl || !measEl || !moreEl) return;

    const rowW = rowEl.getBoundingClientRect().width;

    const moreW = Math.ceil(moreEl.getBoundingClientRect().width);
    const gap = 14;
    const reserve = moreW + gap;

    const avail = rowW - reserve;
    if (avail <= 50) {
      setMobileVisibleCount(0);
      return;
    }

    const nodes = Array.from(measEl.querySelectorAll('[data-measure-cat="1"]'));
    let used = 0;
    let count = 0;

    for (const node of nodes) {
      const w = Math.ceil(node.getBoundingClientRect().width);
      const add = (count === 0 ? 0 : gap) + w;
      if (used + add <= avail) {
        used += add;
        count += 1;
      } else {
        break;
      }
    }

    setMobileVisibleCount(Math.max(0, Math.min(count, sortedCategories.length)));
  }, [isMobileCats, sortedCategories.length]);

  useEffect(() => {
    if (!isMobileCats) return;

    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => recomputeMobileVisibleCount());
      return () => cancelAnimationFrame(raf2);
    });

    let ro;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => recomputeMobileVisibleCount());
      if (catsRowRef.current) ro.observe(catsRowRef.current);
    }

    const onResize = () => recomputeMobileVisibleCount();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf1);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [isMobileCats, sortedCategories, recomputeMobileVisibleCount]);

  const DESKTOP_MAIN_COUNT = 8;

  const mainCategories = useMemo(() => {
    if (isMobileCats) return sortedCategories.slice(0, mobileVisibleCount);
    return sortedCategories.slice(0, DESKTOP_MAIN_COUNT);
  }, [isMobileCats, sortedCategories, mobileVisibleCount]);

  const extraCategories = useMemo(() => {
    if (isMobileCats) return sortedCategories.slice(mobileVisibleCount, 80);
    return sortedCategories.slice(DESKTOP_MAIN_COUNT, 80);
  }, [isMobileCats, sortedCategories, mobileVisibleCount]);

  useEffect(() => {
    async function loadUser() {
      try {
        const data = await whoami();
        setUser(data);
      } catch {
        setUser(null);
      }
    }
    loadUser();
  }, []);

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    navigate("/");
  };

  // FIX 2026-02-16-ADMIN-CABINET + ADMIN-PREFERRED-FLAG:
// - если браузер помечен как "режим админа" (admin_preferred=1),
//   ВСЕГДА уводим в Django-admin (goToAdmin), даже если текущая Django-сессия уже гость.
// - если флага нет, но user.is_superuser === true — тоже уводим в Django-admin.
// - остальные роли (EDITOR, авторы) продолжают ходить в свои кабинеты.
const handlePersonalCabinet = async () => {
  // 1) Глобальный флаг "этот браузер — режим админа".
  if (isAdminPreferred()) {
    await goToAdmin();
    setMenuOpen(false);
    return;
  }

  // 2) Если пользователь не залогинен — отправляем на форму логина.
  if (!user) {
    navigate("/login");
    return;
  }

  // 3) Суперпользователь по данным whoami.
  if (user.is_superuser) {
    // помечаем этот браузер как "режим админа" один раз,
    // чтобы при следующих входах всегда ходить в Django-admin
    setAdminPreferred(true);
    await goToAdmin();
    setMenuOpen(false);
    return;
  }

  // 4) Обычные роли.
  if (user.role === "EDITOR") {
    navigate("/editor-dashboard");
  } else {
    navigate("/author-dashboard");
  }
  setMenuOpen(false);
};


  useEffect(() => {
    const onDocClick = (e) => {
      if (showSearch && popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowSearch(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setShowSearch(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [showSearch]);

  useEffect(() => {
    if (!showSearch) return;

    const closeSearchOnScroll = () => setShowSearch(false);
    const opts = { passive: true };

    window.addEventListener("scroll", closeSearchOnScroll, opts);
    window.addEventListener("wheel", closeSearchOnScroll, opts);
    window.addEventListener("touchmove", closeSearchOnScroll, opts);

    document.addEventListener("scroll", closeSearchOnScroll, opts);
    document.addEventListener("wheel", closeSearchOnScroll, opts);
    document.addEventListener("touchmove", closeSearchOnScroll, opts);

    return () => {
      window.removeEventListener("scroll", closeSearchOnScroll, opts);
      window.removeEventListener("wheel", closeSearchOnScroll, opts);
      window.removeEventListener("touchmove", closeSearchOnScroll, opts);

      document.removeEventListener("scroll", closeSearchOnScroll, opts);
      document.removeEventListener("wheel", closeSearchOnScroll, opts);
      document.removeEventListener("touchmove", closeSearchOnScroll, opts);
    };
  }, [showSearch]);

  useEffect(() => {
    const COLLAPSE_AT = 120;
    const EXPAND_AT = 80;

    let rafId = 0;
    let last = null;

    const getScrollTop = () => {
      const w = window.scrollY || 0;
      const de = document.documentElement ? document.documentElement.scrollTop || 0 : 0;
      const db = document.body ? document.body.scrollTop || 0 : 0;
      const se = document.scrollingElement ? document.scrollingElement.scrollTop || 0 : 0;
      const root = document.getElementById("root");
      const rs = root ? root.scrollTop || 0 : 0;
      return Math.max(w, de, db, se, rs);
    };

    const compute = () => {
      rafId = 0;
      const scrolled = getScrollTop();
      const next = last === true ? scrolled > EXPAND_AT : scrolled > COLLAPSE_AT;

      if (next !== last) {
        last = next;
        setIsCollapsed(next);
      }
    };

    const onAnyScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(compute);
    };

    const opts = { passive: true };

    compute();

    window.addEventListener("scroll", onAnyScroll, opts);
    document.addEventListener("scroll", onAnyScroll, opts);

    const root = document.getElementById("root");
    if (root) root.addEventListener("scroll", onAnyScroll, opts);

    return () => {
      window.removeEventListener("scroll", onAnyScroll, opts);
      document.removeEventListener("scroll", onAnyScroll, opts);
      if (root) root.removeEventListener("scroll", onAnyScroll, opts);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (showDropdown) document.body.classList.add("navbar-categories-open");
    else document.body.classList.remove("navbar-categories-open");
    return () => document.body.classList.remove("navbar-categories-open");
  }, [showDropdown]);

  useEffect(() => {
    if (!showDropdown || extraCategories.length === 0) return;

    const slugsToLoad = extraCategories
      .filter((c) => !c?.__static) // ✅ не грузим обложки для виртуальной категории
      .map((c) => c.slug)
      .filter(Boolean)
      .filter((slug) => !categoryThumbs[slug]);

    if (slugsToLoad.length === 0) return;

    let cancelled = false;
    const controller = new AbortController();

    async function loadThumbs() {
      const updates = {};

      const SAFE_LIMIT = 10;
      const list = slugsToLoad.slice(0, SAFE_LIMIT);

      for (const slug of list) {
        try {
          await sleep(80);

          const resp = await fetch(
            `/api/news/category/${encodeURIComponent(slug)}/?page=1&page_size=20`,
            { signal: controller.signal }
          );

          if (resp.status === 429) {
            console.warn(
              "429 Too Many Requests при загрузке обложек категорий — остановили дальнейшие запросы."
            );
            break;
          }

          if (!resp.ok) continue;

          const raw = await resp.json();
          const items = extractNewsItems(raw);
          if (!items.length) continue;

          const withRealImage = items.filter((n) => {
            const url = pickImageUrl(n);
            if (!url) return false;
            if (url.includes("/media/defaults/default_news.png")) return false;
            return true;
          });

          if (!withRealImage.length) continue;

          const withViews = withRealImage.filter((item) => typeof item.views === "number");

          let chosen = null;

          if (withViews.length && withViews.some((item) => (item.views || 0) > 0)) {
            chosen = withViews.reduce((maxItem, item) =>
              (item.views || 0) > (maxItem.views || 0) ? item : maxItem
            );
          } else {
            chosen = withRealImage[Math.floor(Math.random() * withRealImage.length)];
          }

          const url = pickImageUrl(chosen);
          if (url) updates[slug] = normalizeImgUrl(url);
        } catch (e) {
          if (!cancelled) console.error("Ошибка загрузки обложки категории", slug, e);
        }
      }

      if (!cancelled && Object.keys(updates).length > 0) {
        setCategoryThumbs((prev) => ({ ...prev, ...updates }));
      }
    }

    loadThumbs();
    return () => {
      cancelled = true;
      try {
        controller.abort();
      } catch {
        // ignore
      }
    };
  }, [showDropdown, extraCategories, categoryThumbs]);

  return (
    <header ref={navbarRef} className={`navbar ${isCollapsed ? "navbar--collapsed" : ""}`}>
      {/* ---------- ВЕРХ ---------- */}
      <div className="navbar-top">
        {/* ЛОГОТИП */}
        <span
          className="navbar-logo"
          onClick={() => navigate("/")}
          title="На главную IzotovLife"
          style={{ cursor: "pointer" }}
        >
          <span
            className="logo-svg logo-svg--full"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              userSelect: "none",
            }}
            aria-hidden="true"
          >
            <FaNewspaper style={{ width: 26, height: 26 }} />
            <span style={{ display: "inline-flex", alignItems: "baseline" }}>
              <span style={{ color: "inherit" }}>Izotov</span>
              <span style={{ color: "#1f6feb", marginLeft: "2px" }}>Life</span>
            </span>
          </span>

          <span className="logo-svg logo-svg--icon" aria-hidden="true">
            <FaNewspaper style={{ width: 26, height: 26 }} />
          </span>
        </span>

        {/* Центр: курсы валют + погода */}
        <div className="navbar-center" ref={tickerViewportRef}>
          <SmartTicker
            className="navbar-center-ticker"
            title="Нажмите, чтобы плавно вернуть строку в начало (и поставить паузу)"
            speedDayPxPerSec={50}
            speedNightPxPerSec={35}
            resetDurationMs={650}
            pauseOnResetMs={2000}
          >
            <div
              ref={tickerInnerRef}
              className="navbar-center-inner"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "14px",
                whiteSpace: "nowrap",
                paddingRight: "34px",
              }}
            >
              <div className="rates">
                <CurrencyWidget />
              </div>

              <div className="weather">
                <WeatherWidget />
              </div>

              {/* ✅ Разделитель "|" ТОЛЬКО:
                  - на маленьких экранах (isMobileCats)
                  - и ТОЛЬКО когда тикер реально "бежит" (overflow) */}
              {isMobileCats && tickerOverflow && (
                <span
                  className="ticker-end-sep"
                  aria-hidden="true"
                  style={{
                    opacity: 0.75,
                    userSelect: "none",
                    display: "inline-block",
                    paddingLeft: "6px",
                    paddingRight: "6px",
                    lineHeight: 1,
                  }}
                >
                  |
                </span>
              )}
            </div>
          </SmartTicker>
        </div>

        {/* Правый блок */}
        <div className="navbar-right">
          {/* Поиск */}
          <div className="search-anchor" ref={popoverRef}>
            <button
              className="icon-btn"
              title="Поиск по сайту"
              onClick={() => setShowSearch((v) => !v)}
            >
              <FaSearch />
            </button>

            {showSearch && (
              <div className="search-popover open">
                <button
                  className="close-search"
                  onClick={() => setShowSearch(false)}
                  aria-label="Закрыть поиск"
                >
                  <FaTimes />
                </button>
                <SearchAutocomplete />
              </div>
            )}
          </div>

          {/* Предложить новость */}
          <button
            className="suggest-link suggest-link-btn"
            onClick={() => setOpenSuggest(true)}
            title="Предложить новость"
          >
            <span className="suggest-link__icon">
              <FaLightbulb />
            </span>
            <span className="suggest-link__text">Предложить новость</span>
          </button>

          {/* Гороскоп */}
          <button
            className="horoscope-link horoscope-link-btn"
            onClick={() => navigate("/horoscope")}
            title="Гороскоп"
          >
            <span className="horoscope-link__icon">🔮</span>
            <span className="horoscope-link__text">Гороскоп</span>
          </button>

          {/* Меню */}
          <button className="icon-btn" title="Меню" onClick={() => setMenuOpen(true)}>
            <FaBars />
          </button>
        </div>
      </div>

      {/* ---------- КАТЕГОРИИ ---------- */}
      <nav className="navbar-categories">
        <div className="categories-center" ref={catsRowRef}>
          {mainCategories.map((cat) => (
            <span
              key={cat.slug}
              className="cat-link"
              onClick={(e) => {
                // ✅ FIX 2026-02-15-AUTHOR-ROUTE: не даём ничему "съесть" клик
                e.preventDefault?.();
                e.stopPropagation?.();
                navigate(getCategoryPath(cat));
              }}
              title={
                typeof categoryCounts?.[cat.slug] === "number"
                  ? `${cat.name} (${categoryCounts[cat.slug]})`
                  : cat.name
              }
            >
              {cat.name}
            </span>
          ))}

          {extraCategories.length > 0 && (
            <div className="cat-dropdown">
              <button
                type="button"
                className="cat-link dropdown-trigger"
                onClick={() => setShowDropdown((prev) => !prev)}
                aria-expanded={showDropdown ? "true" : "false"}
              >
                Ещё <FaChevronDown style={{ fontSize: "0.7em" }} />
              </button>
            </div>
          )}

          {/* скрытый измеритель для МОБИЛЫ */}
          <div className="categories-measure" ref={catsMeasureRef} aria-hidden="true">
            <span className="cat-link dropdown-trigger" ref={moreMeasureRef}>
              Ещё <FaChevronDown style={{ fontSize: "0.7em" }} />
            </span>
            {sortedCategories.map((cat) => (
              <span key={cat.slug} className="cat-link" data-measure-cat="1">
                {cat.name}
              </span>
            ))}
          </div>
        </div>
      </nav>

      {/* ---------- ВЫПАДАЮЩИЙ СПИСОК "ЕЩЁ" ---------- */}
      {showDropdown && extraCategories.length > 0 && (
        <>
          <div
            className="navbar-more-overlay"
            onClick={() => setShowDropdown(false)}
          />
          <div className="navbar-more-dropdown">
            {extraCategories.map((cat) => {
              const bg = getCategoryImageUrl(cat, categoryThumbs);
              return (
                <button
                  key={cat.slug}
                  type="button"
                  className="navbar-more-item"
                  onClick={() => {
                    setShowDropdown(false);
                    navigate(getCategoryPath(cat));
                  }}
                  style={{ backgroundImage: `url(${bg})` }}
                  title={
                    typeof categoryCounts?.[cat.slug] === "number"
                      ? `${cat.name} (${categoryCounts[cat.slug]})`
                      : cat.name
                  }
                >
                  <span className="overlay">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

         {/* ---------- БОКОВОЕ МЕНЮ ---------- */}
      {menuOpen && (
        <>
          <div className="overlay" onClick={() => setMenuOpen(false)} />
          <div className="side-menu">
            <button className="close-btn" onClick={() => setMenuOpen(false)}>
              <FaTimes />
            </button>

            {/* Пункт "Категории" убран: страница /categories остаётся,
                но ссылка на неё будет, например, в футере, а не в бургер-меню. */}
            {/*
            <span
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                navigate("/categories");
              }}
            >
              Категории
            </span>
            */}

            {!user && (
              <>
                <span
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/login");
                  }}
                >
                  Войти
                </span>
                <span
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/register");
                  }}
                >
                  Регистрация
                </span>
              </>
            )}

            {user && (
              <>
                {/* FIX 2026-02-16-ADMIN-CABINET:
                    - для суперпользователя и обычных пользователей используем единый обработчик handlePersonalCabinet */}
                {!user.is_superuser && (
                  <span
                    className="menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      handlePersonalCabinet();
                    }}
                  >
                    Личный кабинет
                  </span>
                )}

                {user.is_superuser && (
                  <span
                    className="menu-item"
                    onClick={async () => {
                      // включаем режим "этот браузер — админ"
                      setAdminPreferred(true);
                      await handlePersonalCabinet();
                    }}
                  >
                    Админка
                  </span>
                )}

                <span
                  className="menu-item"
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                >
                  Выйти
                </span>
              </>
            )}
          </div>
        </>
      )}

      {openSuggest && (
        <SuggestNewsModal onClose={() => setOpenSuggest(false)} />
      )}
    </header>
  );
}
