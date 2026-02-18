// Путь: frontend/src/components/UnifiedFeed.js
// Назначение: Единая новостная лента (ONE FEED) для Главной/Категории/Поиска.
// Как у крупных новостных сайтов:
// - один поток карточек (с фото и без фото перемешано)
// - infinite scroll только для лент (НЕ для детальной)
// - минимальная “умность”: hasMore по длине ответа, либо по total (если даёт API)
//
// Важно:
// - fetchPage(page) должен вернуть: { items: Array, hasMore?: boolean }
// - NewsCard сам решает показывать ли изображение.

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import NewsCard from "./NewsCard";
import s from "./UnifiedFeed.module.css";

function safeKey(item, idx) {
  const k =
    item?.id ??
    item?.pk ??
    item?.uuid ??
    item?.slug ??
    item?.news_slug ??
    item?.article_slug ??
    null;
  return `${k ?? "item"}_${idx}`;
}

/**
 * UnifiedFeed
 * @param {Object} props
 * @param {Function} props.fetchPage - async (page:number) => {items:Array, hasMore?:boolean}
 * @param {number} props.pageSize - размер страницы (если нужно для hasMore по длине)
 * @param {boolean} props.enableHero - показывать HERO блок
 * @param {number} props.heroCount - сколько элементов в HERO
 * @param {string} props.emptyText - текст для пустого состояния
 * @param {Function} props.buildForceTo - (item) => string | null (например для поиска: /news/<id|slug>/)
 * @param {Function} props.onOpenItem - (item) => void (если нужно принудительно управлять кликом)
 */
export default function UnifiedFeed({
  fetchPage,
  pageSize = 20,
  enableHero = false,
  heroCount = 1,
  emptyText = "Ничего не найдено.",
  buildForceTo = null,
  onOpenItem = null,
}) {
  const [items, setItems] = useState([]);
  const [hero, setHero] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);

  const sentinelRef = useRef(null);
  const observerRef = useRef(null);

  const split = useMemo(() => {
    if (!enableHero) return { hero: [], rest: items };
    const h = items.slice(0, Math.max(0, heroCount));
    const r = items.slice(Math.max(0, heroCount));
    return { hero: h, rest: r };
  }, [items, enableHero, heroCount]);

  useEffect(() => {
    setHero(split.hero);
  }, [split.hero]);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    loadingRef.current = true;
    pageRef.current = 1;
    hasMoreRef.current = true;

    try {
      const res = await fetchPage(1);
      const list = Array.isArray(res?.items) ? res.items : [];
      setItems(list);

      const hasMoreByApi = typeof res?.hasMore === "boolean" ? res.hasMore : null;
      const hasMoreByLen = list.length >= pageSize;
      hasMoreRef.current = hasMoreByApi !== null ? hasMoreByApi : hasMoreByLen;
    } catch (e) {
      setItems([]);
      hasMoreRef.current = false;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [fetchPage, pageSize]);

  const loadNext = useCallback(async () => {
    if (loadingRef.current) return;
    if (!hasMoreRef.current) return;

    setLoadingMore(true);
    loadingRef.current = true;

    const nextPage = (pageRef.current || 1) + 1;

    try {
      const res = await fetchPage(nextPage);
      const list = Array.isArray(res?.items) ? res.items : [];

      setItems((prev) => [...prev, ...list]);
      pageRef.current = nextPage;

      const hasMoreByApi = typeof res?.hasMore === "boolean" ? res.hasMore : null;
      const hasMoreByLen = list.length >= pageSize;
      hasMoreRef.current = hasMoreByApi !== null ? hasMoreByApi : hasMoreByLen;
    } catch (e) {
      hasMoreRef.current = false;
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [fetchPage, pageSize]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!sentinelRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const ent = entries?.[0];
        if (!ent?.isIntersecting) return;
        if (loading || loadingMore) return;
        if (!hasMoreRef.current) return;
        loadNext();
      },
      { root: null, threshold: 0.1, rootMargin: "200px" }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [loading, loadingMore, loadNext]);

  return (
    <div className={s.feed}>
      {loading ? (
        <div className={s.loading}>Загрузка…</div>
      ) : items.length === 0 ? (
        <div className={s.empty}>{emptyText}</div>
      ) : (
        <>
          {enableHero && hero.length > 0 ? (
            <section className={s.hero}>
              {hero.map((item, idx) => {
                const forceTo = buildForceTo ? buildForceTo(item) : null;
                return (
                  <div key={safeKey(item, idx)} className={s.heroItem}>
                    <NewsCard
                      item={item}
                      variant="hero"
                      forceTo={forceTo}
                      onOpen={onOpenItem || null}
                    />
                  </div>
                );
              })}
            </section>
          ) : null}

          <section className={s.list}>
            {split.rest.map((item, idx) => {
              const forceTo = buildForceTo ? buildForceTo(item) : null;
              return (
                <div key={safeKey(item, idx)} className={s.listItem}>
                  <NewsCard
                    item={item}
                    variant="feed"
                    forceTo={forceTo}
                    onOpen={onOpenItem || null}
                  />
                </div>
              );
            })}
          </section>

          <div ref={sentinelRef} className={s.sentinel}>
            {loadingMore ? <div className={s.loadingMore}>Загрузка…</div> : null}
          </div>
        </>
      )}
    </div>
  );
}
