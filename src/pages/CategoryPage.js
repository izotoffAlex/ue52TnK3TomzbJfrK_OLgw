// Путь: frontend/src/pages/CategoryPage.js
// Назначение: Страница категории с ленивой подгрузкой карточек (как на главной) + текстовый блок.
// Обновления:
//   ✅ Убран заголовок "Текстовые новости" над правым блоком
//   ✅ Убрано слово "Категория" в H1 — теперь показывается только название категории

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import InfiniteScroll from "react-infinite-scroll-component";
import s from "./CategoryPage.module.css";

import { fetchCategoryNews, fetchCategories } from "../Api";
import NewsCard from "../components/NewsCard";
import SourceLabel from "../components/SourceLabel";
import IncomingNewsTray from "../components/IncomingNewsTray";

export default function CategoryPage() {
  const { slug } = useParams();

  const [photoNews, setPhotoNews] = useState([]);
  const [textNews, setTextNews] = useState([]);
  const [categoryName, setCategoryName] = useState(slug);
  const [loading, setLoading] = useState(true);

  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const [hasMore, setHasMore] = useState(true);
  const hasMoreRef = useRef(true);

  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  const gridRef = useRef(null);
  const [prefilled, setPrefilled] = useState(false);

  const [incoming, setIncoming] = useState([]);
  const lastTopKeyRef = useRef(null);

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

  const hasValidImage = useCallback((n) => {
    const img = n.image || n.cover_image || n.preview_image || n.thumbnail;
    if (!img) return false;
    return !String(img).includes("default_news.svg");
  }, []);

  const withTitleParts = useCallback((items) => {
    return items.map((item) => ({
      ...item,
      titleParts: (item.title || "").split("//").map((t) => t.trim()),
    }));
  }, []);

  const getKey = (n) => n?.id ?? n?.slug ?? null;

  // Имя категории в крошках
  useEffect(() => {
    let mounted = true;
    async function loadCategoryName() {
      try {
        const cats = await fetchCategories();
        const found = Array.isArray(cats) ? cats.find((c) => c.slug === slug) : null;
        if (mounted) setCategoryName(found?.name || slug);
      } catch {
        if (mounted) setCategoryName(slug);
      }
    }
    if (slug) loadCategoryName();
    return () => { mounted = false; };
  }, [slug]);

  // Сброс при смене категории
  useEffect(() => {
    setPhotoNews([]);
    setTextNews([]);
    setHasMore(true);
    setLoading(true);
    setPrefilled(false);
    setIncoming([]);
    lastTopKeyRef.current = null;
    pageRef.current = 1;
  }, [slug]);

  // Ленивая подгрузка
  const loadMore = useCallback(async () => {
    if (!slug) return;
    if (loadingRef.current || !hasMoreRef.current) return;

    try {
      loadingRef.current = true;
      const page = pageRef.current;

      const data = await fetchCategoryNews(slug, page);
      const results = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : [];

      const valid = results.filter(hasSomeText);
      const withPhoto = valid.filter(hasValidImage);
      const withoutPhoto = valid.filter((n) => !hasValidImage(n));

      const withPhotoProcessed = withTitleParts(withPhoto);
      const withoutPhotoProcessed = withTitleParts(withoutPhoto);

      const seen = new Set(
        photoNews.map(getKey).concat(textNews.map(getKey)).filter(Boolean)
      );
      const uniquePhoto = withPhotoProcessed.filter((n) => !seen.has(getKey(n)));
      const uniqueText = withoutPhotoProcessed.filter((n) => !seen.has(getKey(n)));

      setPhotoNews((prev) => [...prev, ...uniquePhoto]);
      setTextNews((prev) => [...prev, ...uniqueText]);

      if (page === 1) {
        const top = valid[0];
        if (top) lastTopKeyRef.current = getKey(top);
      }

      const more = results.length > 0;
      setHasMore(more);
      hasMoreRef.current = more;
      pageRef.current = page + 1;
    } catch (e) {
      // 404 — страниц больше нет
      setHasMore(false);
      hasMoreRef.current = false;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [slug, hasSomeText, hasValidImage, withTitleParts, photoNews, textNews]);

  // Первая загрузка
  useEffect(() => {
    if (!slug) return;
    loadMore();
  }, [slug, loadMore]);

  // «Предзаполнение» первого экрана
  useEffect(() => {
    if (prefilled) return;
    if (photoNews.length === 0 && textNews.length === 0) return;

    let cancelled = false;

    const fill = async () => {
      await new Promise((r) => requestAnimationFrame(r));
      for (let i = 0; i < 2; i++) {
        if (cancelled || !hasMoreRef.current) break;

        const grid = gridRef.current;
        const height = grid?.getBoundingClientRect().height || 0;

        const needMore =
          photoNews.length < 6 || height < window.innerHeight * 1.1;

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
  }, [photoNews.length, textNews.length, prefilled, loadMore]);

  // «Входящие» (только для этой категории)
  const pollIncoming = useCallback(async () => {
    try {
      const data = await fetchCategoryNews(slug, 1);
      const results = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : [];
      const valid = results.filter(hasSomeText);
      if (!valid.length) return;

      if (!lastTopKeyRef.current) {
        lastTopKeyRef.current = getKey(valid[0]);
        return;
      }

      const collected = [];
      for (const n of valid) {
        const key = getKey(n);
        if (!key) continue;
        if (key === lastTopKeyRef.current) break;
        collected.push(n);
      }

      if (collected.length) {
        const collectedProcessed = withTitleParts(collected);
        setIncoming((prev) => [...collectedProcessed, ...prev]);
        lastTopKeyRef.current = getKey(valid[0]) ?? lastTopKeyRef.current;
      }
    } catch {}
  }, [slug, hasSomeText, withTitleParts]);

  useEffect(() => {
    const t = setInterval(pollIncoming, 20000);
    return () => clearInterval(t);
  }, [pollIncoming]);

  return (
    <div className={`${s.page} max-w-7xl mx-auto py-6`}>
      {/* Хлебные крошки */}
      <nav className={s.breadcrumbs}>
        <Link to="/">Главная</Link> <span>›</span> <span>{categoryName}</span>
      </nav>

      {/* H1 без слова "Категория" */}
      <h1 className={s.title}>{categoryName}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая — карточки с фото */}
        <div className="lg:col-span-2">
          <InfiniteScroll
            dataLength={photoNews.length}
            next={loadMore}
            hasMore={hasMore}
            loader={<p className="text-gray-400">Загрузка...</p>}
            endMessage={<p className="text-gray-400 mt-4">Больше новостей нет</p>}
            scrollThreshold="1200px"
          >
            <div ref={gridRef} className={s["news-grid"]}>
              {photoNews.map((item, idx) => (
                <NewsCard
                  key={`${item.id ?? item.slug ?? idx}-${idx}`}
                  item={item}
                  eager={idx < 6}
                />
              ))}
            </div>
          </InfiniteScroll>
        </div>

        {/* Правая — текстовые (без заголовка) */}
        <div>
          {loading && textNews.length === 0 ? (
            <p className="text-gray-400">Загрузка...</p>
          ) : textNews.length === 0 ? (
            <p className={s.empty}>Новости без иллюстрации не найдены.</p>
          ) : (
            <ul className="space-y-3">
              {textNews.map((n, idx) => (
                <li
                  key={`text-${n.id ?? n.slug ?? idx}-${idx}`}
                  className="border-b border-gray-700 pb-2"
                >
                  <Link
                    to={n.seo_url ?? `/${n.category?.slug ?? slug}/${n.slug}/`}
                    className="block hover:underline text-sm font-medium"
                  >
                    {n.titleParts ? n.titleParts[0] : n.title}
                  </Link>
                  <SourceLabel item={n} className="text-xs text-gray-400" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Входящие по категории */}
      <IncomingNewsTray
        items={incoming}
        maxRows={3}
        gap={8}
        renderItem={(n) => (
          <Link
            to={n.seo_url ?? `/${n.category?.slug ?? slug}/${n.slug}/`}
            className="no-underline"
            style={{ color: "inherit" }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {n.titleParts ? n.titleParts[0] : n.title}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {n.source?.name || n.source || "Источник неизвестен"}
            </div>
          </Link>
        )}
      />
    </div>
  );
}
