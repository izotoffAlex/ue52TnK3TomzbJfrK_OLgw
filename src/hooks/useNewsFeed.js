// frontend/src/hooks/useNewsFeed.js
// Назначение: бесконечная подгрузка новостей из общей ленты (/feed/)
// Особенности:
//   ✅ Первоначально грузим сразу 2 страницы параллельно
//   ✅ Уникализация по type+id/slug/link (чтобы не было дубликатов)
//   ✅ Разделение новостей на с картинкой и без картинки
//   ✅ Дефолтный тип новости = "rss"
//   ✅ Очистка при смене категории
//   ✅ Ленивая подгрузка через IntersectionObserver

import { useEffect, useState, useRef, useCallback } from "react";
import { fetchFeed } from "../Api";

// -------------------- Уникализация новостей --------------------
function uniqById(items) {
  const seen = new Set();
  return items.filter((it) => {
    const key = `${it.type || "rss"}-${it.id || it.slug || it.link || it.source_url}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// -------------------- Основной хук --------------------
export default function useNewsFeed({ category } = {}) {
  const [textOnly, setTextOnly] = useState([]);
  const [withImages, setWithImages] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef(null);

  // -------------------- Функция загрузки страницы --------------------
  const loadNews = useCallback(
    async (p = page) => {
      if (loading || !hasMore) return;
      setLoading(true);

      try {
        const params = { page: p, page_size: 30 };
        if (category) params.category = category;

        const data = await fetchFeed(params);
        const results = (data.results || []).map((n) => ({
          ...n,
          type: n.type || "rss", // ⚡ дефолтное значение
        }));

        const newText = results.filter((n) => !n.image);
        const newImages = results.filter((n) => n.image);

        setTextOnly((prev) => uniqById([...prev, ...newText]));
        setWithImages((prev) => uniqById([...prev, ...newImages]));

        if (!data.next) setHasMore(false);
      } catch (err) {
        console.error("Ошибка загрузки новостей:", err);
      } finally {
        setLoading(false);
      }
    },
    [page, category, hasMore, loading]
  );

  // -------------------- Очистка при смене категории --------------------
  useEffect(() => {
    setTextOnly([]);
    setWithImages([]);
    setPage(1);
    setHasMore(true);

    // Первая загрузка — сразу 2 страницы параллельно
    (async () => {
      try {
        await Promise.all([loadNews(1), loadNews(2)]);
        setPage(3); // после двух страниц следующая = 3
      } catch (err) {
        console.error("Ошибка начальной загрузки:", err);
      }
    })();
  }, [category, loadNews]);

  // -------------------- Загрузка новых страниц --------------------
  useEffect(() => {
    if (page >= 3) loadNews(page);
  }, [page, loadNews]);

  // -------------------- IntersectionObserver для ленивой подгрузки --------------------
  useEffect(() => {
    if (!loaderRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 1.0 }
    );

    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loaderRef, hasMore, loading]);

  return { textOnly, withImages, loading, hasMore, loaderRef };
}
