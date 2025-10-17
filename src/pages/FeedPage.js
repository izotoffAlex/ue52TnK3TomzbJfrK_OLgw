// Путь: frontend/src/pages/FeedPage.js
// Назначение: Главная лента — карточки с фото и текстовые новости.
// Обновление в ЭТОЙ версии:
//   ❌ УДАЛЕНО: заголовок секции «Текстовые новости» (единственная строка <h2>)
//   ✅ hasSomeText вычищает HTML/неразрывные пробелы, ловит стоп-фразы
//   ✅ Минимальная длина «очищенного» текста — 8 символов
//   ✅ Заголовки с "//" разбиваются на массив titleParts для NewsCard
//   ✅ Остальная логика без изменений (pageRef, InfiniteScroll, IncomingNewsTray)

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import InfiniteScroll from "react-infinite-scroll-component";
import { fetchNews } from "../Api";
import SourceLabel from "../components/SourceLabel";
import NewsCard from "../components/NewsCard";
import IncomingNewsTray from "../components/IncomingNewsTray";
import s from "./FeedPage.module.css";

export default function FeedPage() {
  const [photoNews, setPhotoNews] = useState([]);
  const [textNews, setTextNews] = useState([]);
  const [hasMore, setHasMore] = useState(true);

  const pageRef = useRef(1);
  const loadingRef = useRef(false);

  const lastTopKeyRef = useRef(null);
  const [incoming, setIncoming] = useState([]);

  const gridRef = useRef(null);
  const [prefilled, setPrefilled] = useState(false);

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
    const sImg = String(img);
    return !sImg.includes("default_news.svg");
  }, []);

  const getKey = (n) => n?.id ?? n?.slug ?? null;

  const loadNews = useCallback(async () => {
    try {
      if (loadingRef.current) return;
      loadingRef.current = true;

      const currentPage = pageRef.current;
      const data = await fetchNews(currentPage);

      const results = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : [];

      const valid = results.filter(hasSomeText);
      const withPhoto = valid.filter(hasValidImage);
      const withoutPhoto = valid.filter((n) => !hasValidImage(n));

      if (currentPage === 1 && !lastTopKeyRef.current && valid.length) {
        lastTopKeyRef.current = getKey(valid[0]);
      }

      // ✅ Разбиваем заголовки с "//" на массив titleParts
      const withPhotoProcessed = withPhoto.map((item) => ({
        ...item,
        titleParts: (item.title || "").split("//").map((t) => t.trim()),
      }));
      const withoutPhotoProcessed = withoutPhoto.map((item) => ({
        ...item,
        titleParts: (item.title || "").split("//").map((t) => t.trim()),
      }));

      setPhotoNews((prev) => [...prev, ...withPhotoProcessed]);
      setTextNews((prev) => [...prev, ...withoutPhotoProcessed]);
      setHasMore(results.length > 0);

      pageRef.current = currentPage + 1;
    } catch (err) {
      console.error("Ошибка загрузки новостей:", err);
      setHasMore(false);
    } finally {
      loadingRef.current = false;
    }
  }, [hasSomeText, hasValidImage]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  useEffect(() => {
    if (prefilled) return;
    if (photoNews.length === 0 && textNews.length === 0) return;
    let cancelled = false;

    const fill = async () => {
      await new Promise((r) => requestAnimationFrame(r));
      for (let i = 0; i < 2; i++) {
        if (cancelled || !hasMore) break;
        const grid = gridRef.current;
        const height = grid?.getBoundingClientRect().height || 0;

        const needMore =
          photoNews.length < 6 || height < window.innerHeight * 1.1;

        if (!needMore) {
          setPrefilled(true);
          break;
        }
        await loadNews();
      }
    };

    fill();
    return () => {
      cancelled = true;
    };
  }, [photoNews.length, textNews.length, hasMore, prefilled, loadNews]);

  const pollIncoming = useCallback(async () => {
    try {
      const data = await fetchNews(1);
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
        const collectedProcessed = collected.map((item) => ({
          ...item,
          titleParts: (item.title || "").split("//").map((t) => t.trim()),
        }));

        setIncoming((prev) => [...collectedProcessed, ...prev]);
        lastTopKeyRef.current =
          getKey(valid[0]) ?? lastTopKeyRef.current;
      }
    } catch (e) {}
  }, [hasSomeText]);

  useEffect(() => {
    const t = setInterval(pollIncoming, 20000);
    return () => clearInterval(t);
  }, [pollIncoming]);

  return (
    <div className={`${s["feed-page"]} max-w-7xl mx-auto py-6`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <InfiniteScroll
            dataLength={photoNews.length}
            next={loadNews}
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

        <div>
          {/* ❌ Было: <h2 className="text-lg font-bold mb-3">Текстовые новости</h2> — удалено */}
          <ul className="space-y-3">
            {textNews.map((n, idx) => (
              <li
                key={`text-${n.id ?? n.slug ?? idx}-${idx}`}
                className="border-b border-gray-700 pb-2"
              >
                <Link
                  to={n.seo_url ?? `/news/${n.category?.slug ?? "news"}/${n.slug}/`}
                  className="block hover:underline text-sm font-medium"
                >
                  {/* Используем только первую часть заголовка для списка */}
                  {n.titleParts ? n.titleParts[0] : n.title}
                </Link>
                <SourceLabel item={n} className="text-xs text-gray-400" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ⬇️ Плавающее окно «входящих» без заголовка */}
      <IncomingNewsTray
        items={incoming}
        maxRows={3}
        gap={8}
        renderItem={(n) => (
          <Link
            to={n.seo_url ?? `/news/${n.category?.slug ?? "news"}/${n.slug}/`}
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
