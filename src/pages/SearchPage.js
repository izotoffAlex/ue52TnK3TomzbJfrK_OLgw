// Путь: frontend/src/pages/SearchPage.js
// Назначение: Страница результатов поиска.
//
// ИСПРАВЛЕНО (2026-02-11) (JSX-BUILD-FIX):
// ✅ Починен сломанный блок useMemo(): unifiedResults был вставлен внутрь items.forEach(), из-за чего
//    разрушилась структура функции и "уехала" JSX-разметка (лишний </aside> и Expected corresponding closing tag).
// ✅ Возвращён корректный двухколоночный рендер: слева общий поток (2 фото + 1 текст), справа — "текстовая лента".
// ✅ Сохранена логика safe-перехода на /news/<slug|id>/ через openFromSearch().
// ✅ Стили SearchPage.module.css не ломаем (используем существующие классы).
//
// ДОБАВЛЕНО (2026-02-15-SEARCH-CATEGORY-URL):
// ✅ Если у новости есть категория (category_slug / category.slug и т.п.), открываем её по пути /:category/:slug/.
// ✅ Если категории нет, сохраняем старое поведение /news/:slug/ или /news/:id/.
// ✅ Логика SPA-навигации через openFromSearch() не меняется — меняется только buildSafeNewsDetailUrl().
//
// Важно:
// - Для кликов используем openFromSearch(item) (SPA-навигация + state).
// - Ctrl/Meta/Shift/Alt/middle-click не перехватываем (открытие в новой вкладке работает).

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import NewsCard from "../components/NewsCard";
import s from "./SearchPage.module.css";

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function pickImageUrl(obj) {
  if (!obj || typeof obj !== "object") return null;

  const IMAGE_FIELDS = [
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

  for (const field of IMAGE_FIELDS) {
    const value = obj[field];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (value && typeof value === "object") {
      if (typeof value.url === "string" && value.url.trim()) return value.url.trim();
      if (typeof value.src === "string" && value.src.trim()) return value.src.trim();
    }
  }

  return null;
}

function isDefaultOrBadImageUrl(url) {
  if (!url) return true;
  const urlStr = String(url);
  return (
    urlStr.includes("default_news.png") ||
    urlStr.includes("/media/defaults/") ||
    urlStr.includes("placeholder") ||
    urlStr.includes("default-image")
  );
}

function extractNewsItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (data.data && Array.isArray(data.data.results)) return data.data.results;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function extractPaginationInfo(data) {
  if (!data) return { hasMore: false, nextPage: null };

  if (data.next) return { hasMore: true, nextPage: data.next };
  if (data.next_page) return { hasMore: true, nextPage: data.next_page };
  if (data.pagination?.next) return { hasMore: true, nextPage: data.pagination.next };

  if (data.count !== undefined && data.results && data.results.length < data.count) {
    return { hasMore: true, nextPage: null };
  }

  return { hasMore: false, nextPage: null };
}

function hostName(url) {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    let host = urlObj.hostname || "";

    host = host.replace(/^www\./i, "").replace(/^m\./i, "").replace(/^amp\./i, "");

    const parts = host.split(".");
    if (parts.length > 2) return parts.slice(-2).join(".");
    return host || null;
  } catch {
    return null;
  }
}

function resolveSource(item) {
  if (!item) return { name: "Источник", site_url: null, logo: null };

  const sourceObj = item.source || item.news_source || item.source_fk || item.publisher_obj || null;

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

  let sourceName = "Источник";

  if (sourceNameRaw && String(sourceNameRaw).toLowerCase() !== "rss") {
    sourceName = sourceNameRaw;
  } else {
    const host = hostName(sourceUrl);
    if (host) sourceName = host;
  }

  return {
    name: sourceName,
    site_url: sourceUrl,
    logo: item.source_logo || sourceObj?.logo || sourceObj?.image || sourceObj?.icon || null,
  };
}

// ✅ ОБНОВЛЕНО: теперь пытаемся использовать категорию в URL, если она есть.
function buildSafeNewsDetailUrl(newsItem) {
  if (!newsItem || typeof newsItem !== "object") return "/news/";

  // 1) Собираем slug новости из разных возможных полей
  const slug =
    newsItem.slug || newsItem.news_slug || newsItem.article_slug || null;

  // 2) Пытаемся вытащить slug категории из разных вариантов структуры
  const categorySlug =
    newsItem.category_slug ||
    newsItem.categorySlug ||
    newsItem.category?.slug ||
    newsItem.category_obj?.slug ||
    newsItem.category_fk?.slug ||
    null;

  // 3) Если есть и категория, и slug → используем короткий SEO-путь /:category/:slug/
  //    Этот путь уже поддерживается в App.js (Route path="/:category/:slug" element={<NewsDetailPage />}).
  if (categorySlug && slug) {
    return `/${encodeURIComponent(String(categorySlug))}/${encodeURIComponent(
      String(slug)
    )}/`;
  }

  // 4) Если категории нет, но есть slug → сохраняем старое поведение /news/:slug/
  if (slug) {
    return `/news/${encodeURIComponent(String(slug))}/`;
  }

  // 5) Фолбэк: если нет slug, но есть id/pk/uuid → /news/:id/
  const id = newsItem.id ?? newsItem.pk ?? newsItem.uuid ?? null;
  if (id !== null && id !== undefined && String(id).trim() !== "") {
    return `/news/${encodeURIComponent(String(id))}/`;
  }

  // 6) Самый безопасный фолбэк
  return "/news/";
}

function shouldHandleAsSpaNavigation(e) {
  if (!e) return true;
  if (e.button === 1) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  return true;
}

function safeDateText(item) {
  const v =
    item?.published_at ||
    item?.pub_date ||
    item?.date ||
    item?.created_at ||
    item?.updated_at ||
    item?.pub_date_fmt ||
    "";
  if (!v) return "";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ============================================================================
// ХУК ДЛЯ МАКЕТА (DESKTOP/MOBILE)
// ============================================================================

function useLayoutMode() {
  const [layoutMode, setLayoutMode] = useState("desktop");

  useEffect(() => {
    const calculateLayout = () => {
      const windowWidth = window.innerWidth;
      const containerWidth = Math.min(windowWidth, 1280) - 28;

      const minPhotoGridWidth = 600;
      const rightColumnWidth = 360;
      const gap = 16;
      const requiredWidth = minPhotoGridWidth + rightColumnWidth + gap;

      if (containerWidth >= requiredWidth) setLayoutMode("desktop");
      else setLayoutMode("mobile");
    };

    calculateLayout();
    window.addEventListener("resize", calculateLayout);

    return () => {
      window.removeEventListener("resize", calculateLayout);
    };
  }, []);

  return layoutMode;
}

// ============================================================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================================================

export default function SearchPage() {
  const q = useQuery();
  const navigate = useNavigate();

  const layoutMode = useLayoutMode();
  const isDesktop = layoutMode === "desktop";

  const query = (q.get("q") || "").trim();

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadMoreRef = useRef(null);
  const observerRef = useRef(null);

  // ============================================================================
  // ОТКРЫТИЕ НОВОСТИ ИЗ ПОИСКА
  // ============================================================================

  const openFromSearch = useCallback(
    (item) => {
      // ✅ Теперь URL может быть /:category/:slug/, если категория известна.
      const url = buildSafeNewsDetailUrl(item);

      const categorySlug =
        item?.category_slug ||
        item?.categorySlug ||
        item?.category?.slug ||
        item?.category_obj?.slug ||
        item?.category_fk?.slug ||
        null;

      navigate(url, {
        state: {
          preferredCategorySlug: categorySlug,
          fromSearchQuery: query || null,
          searchItem: item || null,
        },
      });
    },
    [navigate, query]
  );

  // ============================================================================
  // ЗАГРУЗКА
  // ============================================================================

  const loadNews = useCallback(
    async (pageNum = 1, append = false) => {
      if (!query) return;

      const isInitialLoad = pageNum === 1;
      if (isInitialLoad) setLoading(true);
      else setLoadingMore(true);

      try {
        const response = await fetch(
          `/api/news/search/?q=${encodeURIComponent(query)}&page=${pageNum}&page_size=30`
        );

        if (!response.ok) {
          throw new Error(`HTTP ошибка: ${response.status}`);
        }

        const data = await response.json();
        const newItems = extractNewsItems(data);
        const paginationInfo = extractPaginationInfo(data);

        if (append) setItems((prevItems) => [...prevItems, ...newItems]);
        else setItems(newItems);

        setHasMore(paginationInfo.hasMore);
        setPage(pageNum);
      } catch (error) {
        console.error("Ошибка при загрузке новостей:", error);
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query]
  );

  useEffect(() => {
    if (!query) {
      setItems([]);
      setHasMore(true);
      setPage(1);
      return;
    }

    const timer = setTimeout(() => {
      setItems([]);
      setHasMore(true);
      setPage(1);
      loadNews(1, false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, loadNews]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadNews(page + 1, true);
        }
      },
      { threshold: 0.5, rootMargin: "100px" }
    );

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, loading, loadingMore, page, loadNews]);

  // ============================================================================
  // РАЗБОР РЕЗУЛЬТАТОВ
  // ============================================================================

  const { withPhoto, textOnly } = useMemo(() => {
    const withPhotoItems = [];
    const textOnlyItems = [];

    (Array.isArray(items) ? items : []).forEach((item) => {
      const imageUrl = pickImageUrl(item);
      const hasPhoto = imageUrl && !isDefaultOrBadImageUrl(imageUrl);

      if (hasPhoto) withPhotoItems.push(item);
      else textOnlyItems.push(item);
    });

    return { withPhoto: withPhotoItems, textOnly: textOnlyItems };
  }, [items]);

  // ✅ Единый поток результатов: 2 карточки с фото + 1 текстовая
  const unifiedResults = useMemo(() => {
    const photos = Array.isArray(withPhoto) ? withPhoto : [];
    const texts = Array.isArray(textOnly) ? textOnly : [];

    const out = [];
    let i = 0;
    let j = 0;
    while (i < photos.length || j < texts.length) {
      for (let k = 0; k < 2 && i < photos.length; k += 1) {
        out.push({ kind: "card", item: photos[i] });
        i += 1;
      }
      if (j < texts.length) {
        out.push({ kind: "text", item: texts[j] });
        j += 1;
      }
    }
    return out;
  }, [withPhoto, textOnly]);

  // ============================================================================
  // SEO
  // ============================================================================

  const canonicalUrl = "https://izotovlife.ru/search/";
  const seoTitle = query ? `Поиск новостей: «${query}» — IzotovLife` : "Поиск новостей — IzotovLife";
  const seoDescription = query
    ? `Результаты поиска новостей по запросу «${query}» на IzotovLife. Подборка актуальных публикаций из разных источников.`
    : "Поиск новостей на IzotovLife. Найдите публикации по интересующей теме.";

  // ============================================================================
  // РЕНДЕР
  // ============================================================================

  return (
    <div className={`${s["search-page"]} ${s.page}`}>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <meta name="robots" content="noindex,follow" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
      </Helmet>

      <div className={s["search-header-row"]}>
        <h1 className={s["search-header-title"]}>Результаты поиска</h1>
        <div className={s["search-query-text"]}>
          {query ? (
            <>
              Запрос: <span className={s["query-strong"]}>{query}</span>
              <span className={s["results-count"]}> • {items.length} новостей</span>
            </>
          ) : (
            <>Введите запрос в поиск</>
          )}
        </div>
      </div>

      {loading && <div className={s.loading}>Загрузка…</div>}

      {!loading && query && items.length === 0 && (
        <div className={s.empty}>
          Ничего не найдено. Попробуйте другой запрос.
          <div style={{ marginTop: 10 }}>
            <button className={s["back-btn"]} onClick={() => navigate("/")} type="button">
              На главную
            </button>
          </div>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className={`${s["search-layout"]} ${isDesktop ? s.desktop : s.mobile}`}>
            <section className={s["search-left"]}>
              <div className={`${s["search-grid"]} ${s["photo-grid"]}`}>
                {unifiedResults.map((row, index) => {
                  const item = row.item;
                  const safeUrl = buildSafeNewsDetailUrl(item);

                  // 1) Карточка с фото → как раньше через NewsCard
                  if (row.kind === "card") {
                    return (
                      <div
                        key={`card_${item?.id ?? item?.pk ?? item?.slug ?? item?.uuid}_${index}`}
                        className={s["search-photo-card"]}
                        onClickCapture={(e) => {
                          if (!shouldHandleAsSpaNavigation(e)) return;

                          const target = e?.target;
                          const anchor =
                            target && typeof target.closest === "function" ? target.closest("a") : null;
                          if (anchor) e.preventDefault();

                          openFromSearch(item);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openFromSearch(item);
                          }
                        }}
                        role="link"
                        tabIndex={0}
                        aria-label="Открыть новость"
                        data-safe-url={safeUrl}
                      >
                        <NewsCard item={item} badgeAlign="left" />
                      </div>
                    );
                  }

                  // 2) Текстовая строка (как у правой колонки)
                  const src = resolveSource(item);
                  const dt = safeDateText(item);

                  return (
                    <div
                      key={`txt_${item?.id ?? item?.pk ?? item?.slug ?? item?.uuid}_${index}`}
                      className={s["text-news-item"]}
                      onClickCapture={(e) => {
                        if (!shouldHandleAsSpaNavigation(e)) return;
                        e.preventDefault();
                        openFromSearch(item);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openFromSearch(item);
                        }
                      }}
                      role="link"
                      tabIndex={0}
                      aria-label="Открыть новость"
                    >
                      <span className={s["text-title"]}>
                        {String(item?.title || "").trim() || "Без заголовка"}
                      </span>
                      <div className={s["text-meta"]}>
                        <span className={s["text-source"]}>{src?.name || "Источник"}</span>
                        {dt ? <span className={s["text-date"]}>{dt}</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasMore && (
                <div ref={loadMoreRef} className={s["load-more-container"]}>
                  {loadingMore && <div className={s["loading-more"]}>Загрузка дополнительных новостей…</div>}
                </div>
              )}
            </section>

            {/* Правая колонка — только на desktop (как в CSS), на mobile не показываем отдельным блоком */}
            {isDesktop ? (
              <aside className={s["search-right"]}>
                <div className={s["search-right-list"]}>
                  {(Array.isArray(textOnly) ? textOnly : []).slice(0, 40).map((item, idx) => {
                    const src = resolveSource(item);
                    const dt = safeDateText(item);
                    return (
                      <div
                        key={`right_${item?.id ?? item?.pk ?? item?.slug ?? item?.uuid}_${idx}`}
                        className={s["text-news-item"]}
                        onClickCapture={(e) => {
                          if (!shouldHandleAsSpaNavigation(e)) return;
                          e.preventDefault();
                          openFromSearch(item);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openFromSearch(item);
                          }
                        }}
                        role="link"
                        tabIndex={0}
                        aria-label="Открыть новость"
                      >
                        <span className={s["text-title"]}>
                          {String(item?.title || "").trim() || "Без заголовка"}
                        </span>
                        <div className={s["text-meta"]}>
                          <span className={s["text-source"]}>{src?.name || "Источник"}</span>
                          {dt ? <span className={s["text-date"]}>{dt}</span> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </aside>
            ) : null}
          </div>
        </>
      )}

      {loadingMore && !loadMoreRef.current && (
        <div className={s["loading-more-global"]}>
          <div className={s["loading-spinner"]}></div>
          <div>Загрузка дополнительных новостей…</div>
        </div>
      )}
    </div>
  );
}
