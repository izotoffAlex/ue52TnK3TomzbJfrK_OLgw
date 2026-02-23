// Путь: frontend/src/components/Navbar.js
// Назначение:
//   Адаптивная фиксированная шапка IzotovLife:
//   - логотип / переход на главную
//   - бегущая строка с курсами и погодой
//   - поиск в поповере
//   - кнопка "Предложить новость"
//   - кнопка "Гороскоп"
//   - иконка аккаунта (вход/регистрация/кабинет/админка)
//   - бургер-меню справа с вертикальным списком категорий и кнопкой "Показать ещё"
//
// ВАЖНО по ТЗ (февраль 2026):
//   • Вход/регистрация ВЫНЕСЕНЫ только в иконку аккаунта в шапке.
//   • В бургер-меню НЕТ блока входа/регистрации, там только категории.
//   • В боковом меню:
//       - сначала показывается до 10 категорий,
//       - если категорий больше, снизу появляется "Показать ещё" со стрелкой,
//       - при каждом клике добавляется ещё по 10 категорий вниз (N = SIDE_CATS_STEP),
//       - список идёт ровным столбиком вниз.

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  whoami,
  setToken,
  goToAdmin,
  fetchCategories,
  isAdminPreferred,
  setAdminPreferred,
    adminSessionLogin, // <‑‑ добавить
} from "../Api";

import {
  FaSearch,
  FaBars,
  FaTimes,
  FaChevronDown,
  FaNewspaper,
  FaLightbulb,
  FaUser,
} from "react-icons/fa";
import { FaRegStar } from "react-icons/fa"; // иконка для Гороскопа

import SuggestNewsModal from "./SuggestNewsModal";
import WeatherWidget from "./WeatherWidget";
import CurrencyWidget from "./CurrencyWidget";
import SmartTicker from "./SmartTicker";
import SearchAutocomplete from "./search/SearchAutocomplete";


import "./Navbar.css";

// Фолбэк-картинка для категорий (когда нет своей обложки)
const CAT_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="160"><rect width="100%" height="100%" fill="#0a0f1a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#5a6b84" font-family="Arial" font-size="14">Категория</text></svg>'
  );

// Виртуальная категория "Авторские материалы" — всегда присутствует в списке
// даже если её нет в ответе API.
const STATIC_AUTHOR_CATEGORY = {
  slug: "avtorskie-materialy",
  name: "Авторские материалы",
  __static: true,
};



// Вспомогательная проверка: похожа ли строка на slug (латиница/цифры/дефис)
function looksLikeSlug(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (/[А-Яа-яЁё]/.test(s)) return false;
  return /^[a-z0-9-]+$/i.test(s);
}

// Нормализуем имя "Авторские материалы", если в API прилетел slug-подобный мусор
function normalizeCategoryNameForUI(cat) {
  if (!cat || typeof cat !== "object") return cat;

  const slug = String(cat.slug || "").trim();
  if (slug !== "avtorskie-materialy") return cat;

  const name = String(cat.name || "").trim();
  if (!name || looksLikeSlug(name) || /avtorskie/i.test(name)) {
    return { ...cat, name: "Авторские материалы" };
  }

  return cat;
}

// Фолбэк-загрузка категорий напрямую через fetch, если fetchCategories() упал
async function fetchCategoriesFallbackViaApi(signal) {
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
      // игнорируем и идём к следующему URL
    }
  }

  return [];
}

/** =========================
 *  КЭШ и защита от 429 для счётчиков категорий
 *  ========================= */

const COUNTS_CACHE_KEY = "izotovlife_category_counts_v1";
const COUNTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 часов
const COUNTS_MAX_FETCH_PER_BOOT = 12; // максимум запросов за "сессию загрузки"
const COUNTS_POOL_LIMIT = 2; // параллельных запросов
const COUNTS_REQUEST_DELAY_MS = 120; // задержка между запросами

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Чтение кэша счётчиков категорий из localStorage
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

// Запись кэша счётчиков категорий
function writeCountsCache(nextMap) {
  try {
    localStorage.setItem(
      COUNTS_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), data: nextMap || {} })
    );
  } catch {
    // игнорируем ошибки localStorage
  }
}

// Берём ссылку на картинку из разных возможных полей объекта новости/категории
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
      if (typeof val.url === "string" && val.url.trim().length > 0)
        return val.url.trim();
      if (typeof val.src === "string" && val.src.trim().length > 0)
        return val.src.trim();
    }
  }

  return null;
};

// Универсальный извлекатель массива новостей из разных форматов ответа API
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

// Нормализация URL-картинки: переводим http -> https
const normalizeImgUrl = (url) => {
  if (!url) return url;
  const s = String(url).trim();
  if (!s) return s;
  if (s.startsWith("http://")) return "https://" + s.slice("http://".length);
  return s;
};

// Извлекаем счётчик новостей прямо из объекта категории (если есть)
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
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)))
      return Number(v);
  }
  return null;
};

// Точный запрос для получения счётчика по категории (первая страница, page_size=1)
async function fetchCategoryCount(slug, signal) {
  const url = `/api/news/category/${encodeURIComponent(
    slug
  )}/?page=1&page_size=1`;
  const resp = await fetch(url, { credentials: "same-origin", signal });

  if (resp.status === 429) return "THROTTLED";
  if (!resp.ok) return null;

  const raw = await resp.json();
  if (typeof raw?.count === "number" && Number.isFinite(raw.count))
    return raw.count;

  const items = extractNewsItems(raw);
  if (Array.isArray(items)) return items.length;

  return null;
}

// Примитивный пулл запросов (ограничиваем число параллельных worker'ов)
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
  // Открыто ли боковое меню
  const [menuOpen, setMenuOpen] = useState(false);

  // Текущий пользователь (whoami)
  const [user, setUser] = useState(null);
  const isAuth = !!user; // true, если whoami вернул пользователя


  // Модалка "Предложить новость"
  const [openSuggest, setOpenSuggest] = useState(false);

  // Состояния для поповеров
  const [showDropdown, setShowDropdown] = useState(false); // старое "Ещё" по категориям (верх) — сейчас не используется
  const [showSearch, setShowSearch] = useState(false); // открыт ли поповер поиска
  const [showAccountMenu, setShowAccountMenu] = useState(false); // открыт ли поповер аккаунта

  // Категории, превью, счётчики
  const [categories, setCategories] = useState([]);
  const [categoryThumbs, setCategoryThumbs] = useState({});
  const [categoryCounts, setCategoryCounts] = useState({});

  // Флаг "мобильного" режима для блока категорий (ширина <= 900px)
  const [isMobileCats, setIsMobileCats] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(max-width: 900px)").matches ?? false;
  });
  const [mobileVisibleCount, setMobileVisibleCount] = useState(4);

  // Флаг "шапка сжата" при скролле
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Тикер курсы+погода: есть ли переполнение по ширине
  const [tickerOverflow, setTickerOverflow] = useState(false);

  // Для бокового меню: сколько категорий показываем сейчас (старт — 10)
  const SIDE_CATS_STEP = 10;
  const [sideCatsVisibleCount, setSideCatsVisibleCount] =
    useState(SIDE_CATS_STEP);

  const navigate = useNavigate();

  // Реfs для кликов снаружи / измерений
  const popoverRef = useRef(null); // поповер поиска
  const accountRef = useRef(null); // поповер аккаунта

  const catsRowRef = useRef(null); // для старой логики категорий в шапке
  const catsMeasureRef = useRef(null);
  const moreMeasureRef = useRef(null);

  const navbarRef = useRef(null); // корневой header

  const tickerViewportRef = useRef(null); // контейнер тикера
  const tickerInnerRef = useRef(null); // контент тикера

  // Функция формирует URL категории с учётом "Авторских материалов"
  const getCategoryPath = useCallback((cat) => {
    const slug = String(cat?.slug || "").trim();
    const name = String(cat?.name || "").trim().toLowerCase();

    if (slug === "avtorskie-materialy") return "/avtorskie-materialy/";
    if (name === "авторские материалы") return "/avtorskie-materialy/";

    if (!slug) return "/";
    return `/${slug}/`;
  }, []);

  // При монтировании добавляем класс на body, чтобы можно было смещать контент вниз
  useEffect(() => {
    document.body.classList.add("has-navbar");
    return () => document.body.classList.remove("has-navbar");
  }, []);

  // Принудительно включаем светлую тему для шапки (white/light)
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    const ALL_THEME_CLASSES = [
      "theme-graphite",
      "theme-white",
      "theme-light",
      "theme-dark",
    ];
    body.classList.remove(...ALL_THEME_CLASSES);
    html.classList.remove(...ALL_THEME_CLASSES);

    body.classList.add("theme-white", "theme-light");
    html.classList.add("theme-white", "theme-light");

    html.setAttribute("data-theme", "light");
    body.setAttribute("data-theme", "light");

    localStorage.setItem("theme", "white");
  }, []);

  // Измеряем высоту шапки и сохраняем в CSS-переменную --navbar-offset,
  // чтобы остальной контент мог корректно отступать сверху.
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

  // Отслеживаем медиазапрос (<=900px) для мобильного поведения категорий
  useEffect(() => {
    const onResize = () => {
      const v = window.matchMedia?.("(max-width: 900px)").matches ?? false;
      setIsMobileCats(v);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);


  // Тикер: измеряем ширину и решаем, есть ли переполнение
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
        const overflow = innerW > vpW + 2;
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

  // Загрузка категорий (с учётом фолбэка и "Авторских материалов")
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadCategories() {
      try {
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

        if (!cats || cats.length === 0) {
          const fallback = await fetchCategoriesFallbackViaApi(controller.signal);
          cats = fallback || [];
        }

        if (cancelled) return;

        // Нормализуем имена и добавляем "Авторские материалы", если ещё нет
        const normalized = (cats || []).map((c) => normalizeCategoryNameForUI(c));
        const hasAuthor = normalized.some(
          (c) => String(c?.slug || "").trim() === "avtorskie-materialy"
        );
        const finalCats = hasAuthor ? normalized : [...normalized, STATIC_AUTHOR_CATEGORY];

        setCategories(finalCats);
        // Сбрасываем количество видимых категорий в боковом меню
        setSideCatsVisibleCount(SIDE_CATS_STEP);
      } catch (e) {
        console.error("Ошибка загрузки категорий:", e);
        if (!cancelled) {
          setCategories([STATIC_AUTHOR_CATEGORY]);
          setSideCatsVisibleCount(SIDE_CATS_STEP);
        }
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

  // Догрузка счётчиков категорий с кэшем и лимитом запросов
  useEffect(() => {
    if (!categories || categories.length === 0) return;

    let cancelled = false;
    const controller = new AbortController();

    async function loadCounts() {
      const cache = readCountsCache();
      const updates = {};
      let cacheTouched = false;

      // 1) сначала забираем inline-счётчики из объектов категорий
      for (const c of categories) {
        if (!c?.slug) continue;
        if (c.__static) continue;

        const inline = getInlineCountFromCategory(c);
        if (inline !== null) {
          updates[c.slug] = inline;
          if (cache[c.slug] !== inline) {
            cache[c.slug] = inline;
            cacheTouched = true;
          }
        }
      }

      // 2) добираем из кэша, если нет inline
      for (const c of categories) {
        if (!c?.slug) continue;
        if (c.__static) continue;
        if (updates[c.slug] !== undefined) continue;

        const cached = cache[c.slug];
        if (typeof cached === "number" && Number.isFinite(cached)) {
          updates[c.slug] = cached;
        }
      }

      // 3) формируем список slug'ов, для которых нет ни inline, ни кэша
      const need = categories
        .filter((c) => c?.slug && !c.__static)
        .map((c) => c.slug)
        .filter((slug) => updates[slug] === undefined);

      const needLimited = need.slice(0, COUNTS_MAX_FETCH_PER_BOOT);

      if (needLimited.length > 0) {
        let throttled = false;

        const fetched = await runPool(
          needLimited,
          COUNTS_POOL_LIMIT,
          async (slug) => {
            if (throttled) return null;
            await sleep(COUNTS_REQUEST_DELAY_MS);

            const cnt = await fetchCategoryCount(slug, controller.signal);
            if (cnt === "THROTTLED") {
              throttled = true;
              return { slug, cnt: null, throttled: true };
            }
            return { slug, cnt };
          }
        );

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

  // Сортировка категорий:
  //   1) "Авторские материалы" всегда сверху
  //   2) далее по убыванию счётчика новостей
  //   3) при равенстве — по исходному порядку
  const sortedCategories = useMemo(() => {
    if (!categories || categories.length === 0) return [STATIC_AUTHOR_CATEGORY];

    const indexed = categories.map((c, i) => ({ c, i }));
    indexed.sort((a, b) => {
      const aSlug = String(a.c?.slug || "").trim();
      const bSlug = String(b.c?.slug || "").trim();

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

  // Старая логика расчёта количества категорий в шапке (если вернуть):
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

  // Ниже используются, только если вернуть категории в шапку
  const DESKTOP_MAIN_COUNT = 8;

  const mainCategories = useMemo(() => {
    if (isMobileCats) return sortedCategories.slice(0, mobileVisibleCount);
    return sortedCategories.slice(0, DESKTOP_MAIN_COUNT);
  }, [isMobileCats, sortedCategories, mobileVisibleCount]);

  const extraCategories = useMemo(() => {
    if (isMobileCats) return sortedCategories.slice(mobileVisibleCount, 80);
    return sortedCategories.slice(DESKTOP_MAIN_COUNT, 80);
  }, [isMobileCats, sortedCategories, mobileVisibleCount]);

  // Для бокового меню: видимые категории — первые sideCatsVisibleCount штук
  const sideVisibleCategories = useMemo(
    () => sortedCategories.slice(0, sideCatsVisibleCount),
    [sortedCategories, sideCatsVisibleCount]
  );
  const hasMoreSideCats = sideCatsVisibleCount < sortedCategories.length;

  // Загрузка текущего пользователя
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

  // Логаут
  const handleLogout = () => {
    setToken(null);
    setUser(null);
    navigate("/");
  };

  // Переход в личный кабинет / админку с учётом admin_preferred
  const handlePersonalCabinet = async () => {
    if (isAdminPreferred()) {
      await goToAdmin();
      setMenuOpen(false);
      return;
    }

    if (!user) {
      navigate("/login");
      return;
    }

    if (user.is_superuser) {
      setAdminPreferred(true);
      await goToAdmin();
      setMenuOpen(false);
      return;
    }

    if (user.role === "EDITOR") {
      navigate("/editor-dashboard");
    } else {
      navigate("/author-dashboard");
    }
    setMenuOpen(false);
  };

  // Обработчики клика снаружи/ESC для закрытия поиска и аккаунт-меню
  useEffect(() => {
    const onDocClick = (e) => {
      if (showSearch && popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowSearch(false);
      }
      if (
        showAccountMenu &&
        accountRef.current &&
        !accountRef.current.contains(e.target)
      ) {
        setShowAccountMenu(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === "Escape") {
        setShowSearch(false);
        setShowAccountMenu(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [showSearch, showAccountMenu]);

  // Закрытие поиска при скролле/прокрутке
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

  // Сжатие шапки при скролле (isCollapsed)
  useEffect(() => {
    const COLLAPSE_AT = 120;
    const EXPAND_AT = 80;

    let rafId = 0;
    let last = null;

    const getScrollTop = () => {
      const w = window.scrollY || 0;
      const de = document.documentElement
        ? document.documentElement.scrollTop || 0
        : 0;
      const db = document.body ? document.body.scrollTop || 0 : 0;
      const se = document.scrollingElement
        ? document.scrollingElement.scrollTop || 0
        : 0;
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

  // Технический флаг, если когда-нибудь вернём оверлей с "Ещё" по категориям
  useEffect(() => {
    if (showDropdown) document.body.classList.add("navbar-categories-open");
    else document.body.classList.remove("navbar-categories-open");
    return () => document.body.classList.remove("navbar-categories-open");
  }, [showDropdown]);

  // Ленивая догрузка превью-картинок для extraCategories (если вернём "Ещё" в шапке)
  useEffect(() => {
    if (!showDropdown || extraCategories.length === 0) return;

    const slugsToLoad = extraCategories
      .filter((c) => !c?.__static)
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

          // Фильтруем реальные картинки, отличные от дефолтной
          const withRealImage = items.filter((n) => {
            const url = pickImageUrl(n);
            if (!url) return false;
            if (url.includes("/media/defaults/default_news.png")) return false;
            return true;
          });

          if (!withRealImage.length) continue;

          const withViews = withRealImage.filter(
            (item) => typeof item.views === "number"
          );

          let chosen = null;

          // Если есть просмотры — берём новость с максимальными views
          if (withViews.length && withViews.some((item) => (item.views || 0) > 0)) {
            chosen = withViews.reduce((maxItem, item) =>
              (item.views || 0) > (maxItem.views || 0) ? item : maxItem
            );
          } else {
            // иначе берём случайную
            chosen =
              withRealImage[Math.floor(Math.random() * withRealImage.length)];
          }

          const url = pickImageUrl(chosen);
          if (url) updates[slug] = normalizeImgUrl(url);
        } catch (e) {
          if (!cancelled)
            console.error("Ошибка загрузки обложки категории", slug, e);
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
    <header
      ref={navbarRef}
      className={`navbar ${isCollapsed ? "navbar--collapsed" : ""}`}
    >
      {/* ====== ВЕРХНЯЯ ПАНЕЛЬ ШАПКИ ====== */}
      <div className="navbar-top">
        {/* Логотип: кликабельный, ведёт на главную */}
        <span
          className="navbar-logo"
          onClick={() => navigate("/")}
          title="На главную IzotovLife"
          style={{ cursor: "pointer" }}
        >
          {/* Вариант с текстом IzotovLife */}
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

          {/* Компактный иконка-логотип для очень узких экранов */}
          <span className="logo-svg logo-svg--icon" aria-hidden="true">
            <FaNewspaper style={{ width: 26, height: 26 }} />
          </span>
        </span>

        {/* Центр: бегущая строка — курсы + погода, реагирует на overflow */}
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

              {/* В мобильном режиме добавляем разделитель, если есть переполнение */}
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

        {/* Правый блок: поиск, предложить новость, гороскоп, аккаунт, бургер */}
<div className="navbar-right">
  {/* Поиск — иконка + поповер с автодополнением */}
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
  {/* дальше — "Предложить", "Гороскоп", аккаунт, бургер */}


{/* Кнопка "Предложить новость" — только иконка лампочки */}
<button
  className="suggest-link suggest-link-btn"
  type="button"
  onClick={() => setOpenSuggest(true)}
  title="Предложить новость"
>
  <FaLightbulb className="suggest-link__icon" />
</button>


       {/* Кнопка "Гороскоп"
    Назначение:
    – переход на страницу /horoscope
    – всегда показывает только тематическую иконку (без текста)
*/}
<button
  className="horoscope-link horoscope-link-btn"
  onClick={() => navigate("/horoscope")}
  title="Гороскоп"
>
  {/* Тематическая иконка из react-icons вместо эмодзи 🔮 */}
  <FaRegStar className="horoscope-link__icon horoscope-link__icon--horoscope" />
</button>





          {/* Иконка аккаунта — ЕДИНСТВЕННОЕ место входа/регистрации по ТЗ */}
          <div className="account-anchor" ref={accountRef}>
            <button
              className="icon-btn"
              title={user ? "Аккаунт" : "Вход / регистрация"}
              onClick={() => setShowAccountMenu((v) => !v)}
            >
              <FaUser />
            </button>

            {showAccountMenu && (
              <div className="account-popover">
                {/* Гость: Войти / Регистрация */}
                {!user ? (
                  <>
                    <button
                      type="button"
                      className="account-popover-item"
                      onClick={() => {
                        setShowAccountMenu(false);
                        navigate("/login");
                      }}
                    >
                      Войти
                    </button>
                    <button
                      type="button"
                      className="account-popover-item"
                      onClick={() => {
                        setShowAccountMenu(false);
                        navigate("/register");
                      }}
                    >
                      Регистрация
                    </button>
                  </>
                ) : (
                  // Авторизован: ЛК / Админка / Выход
                  <>
                    {!user.is_superuser && (
                      <button
                        type="button"
                        className="account-popover-item"
                        onClick={() => {
                          setShowAccountMenu(false);
                          handlePersonalCabinet();
                        }}
                      >
                        Личный кабинет
                      </button>
                    )}
                    {user.is_superuser && (
                      <button
                        type="button"
                        className="account-popover-item"
                        onClick={async () => {
                          setShowAccountMenu(false);
                          setAdminPreferred(true);
                          await handlePersonalCabinet();
                        }}
                      >
                        Админка
                      </button>
                    )}
                    <button
                      type="button"
                      className="account-popover-item"
                      onClick={() => {
                        setShowAccountMenu(false);
                        handleLogout();
                      }}
                    >
                      Выйти
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Бургер-меню справа: открывает боковую панель с категориями */}
          <button
            className="icon-btn"
            title="Меню"
            onClick={() => setMenuOpen(true)}
          >
            <FaBars />
          </button>
        </div>
      </div>

      {/* Категории под шапкой (navbar-categories) по ТЗ скрыты — оставлено на будущее */}

      {/* ====== БОКОВОЕ БУРГЕР-МЕНЮ C КАТЕГОРИЯМИ ====== */}
      {menuOpen && (
        <>
          {/* Оверлей затемнения фона */}
          <div className="overlay" onClick={() => setMenuOpen(false)} />

          {/* Панель справа */}
          <div className="side-menu">
            {/* Кнопка закрытия меню */}
            <button className="close-btn" onClick={() => setMenuOpen(false)}>
              <FaTimes />
            </button>

            {/* Блок категорий: вертикальный список + "Показать ещё" */}
            <div className="side-menu-section">
              <div className="side-menu-section-title">Категории</div>

              <div className="side-menu-categories">
                {/* Выводим первые sideCatsVisibleCount категорий в аккуратный столбик */}
                {sideVisibleCategories.map((cat) => (
                  <button
                    key={cat.slug}
                    type="button"
                    className="side-menu-item side-menu-item--category"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(getCategoryPath(cat));
                    }}
                    title={
                      typeof categoryCounts?.[cat.slug] === "number"
                        ? `${cat.name} (${categoryCounts[cat.slug]})`
                        : cat.name
                    }
                  >
                    {cat.name}
                  </button>
                ))}

                {/* Если категорий ещё осталось — показываем кнопку "Показать ещё" */}
                {hasMoreSideCats && (
                  <button
                    type="button"
                    className="side-menu-item side-menu-item--more"
                    onClick={() =>
                      setSideCatsVisibleCount((prev) =>
                        Math.min(sortedCategories.length, prev + SIDE_CATS_STEP)
                      )
                    }
                  >
                    Показать ещё{" "}
                    <FaChevronDown
                      style={{ fontSize: "0.7em", marginLeft: 6 }}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* По ТЗ: никакого блока входа/регистрации в боковом меню — всё через иконку аккаунта в шапке */}
          </div>
        </>
      )}

      {/* Модалка "Предложить новость" */}
      {openSuggest && <SuggestNewsModal onClose={() => setOpenSuggest(false)} />}
    </header>
  );
}


