/* Путь: frontend/src/components/RelatedList.jsx
   Назначение: Блок «Похожие новости» для детальной страницы.
   Что делает:
     - Стартует загрузку ПАРАЛЛЕЛЬНО основной новости (по одному только slug).
     - Показывает скелетоны, чтобы не было «прыжка» макета.
     - Имеет in-memory кеш на 5 минут, чтобы мгновенно показывать при повторных заходах.
   Изменения (FIX v2025-12-21):
     ✅ Картинки рендерятся через SmartMedia (исправляет localhost/http→https и относительные /media пути)
     ✅ Логика загрузки/кеша сохранена
*/

import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { fetchRelated } from "../Api";
import SmartMedia from "./SmartMedia";
import s from "./RelatedList.module.css";

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="100%" height="100%" fill="#0a0f1a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#5a6b84" font-family="Arial" font-size="16">Нет изображения</text></svg>',
  );

// Простой кеш в памяти (живёт пока свежая вкладка)
const CACHE_TTL_MS = 5 * 60 * 1000;
const relatedCache = new Map(); // key: slug, value: { ts, items }

function buildArticleUrl(item) {
  // Универсальный билдер пути. Предпочитаем готовый seo_url, иначе /<category>/<slug>/
  const seo = item?.seo_url || item?.seoPath || item?.seo; // подстраховка под разные названия
  if (seo) return seo.startsWith("/") ? seo : `/${seo}`;
  const c = item?.category_slug || item?.category?.slug || item?.category || "bez-kategorii";
  const slug = item?.slug || item?.news_slug || "";
  return `/${c}/${slug}/`;
}

function pickImage(item) {
  return item?.image || item?.image_url || item?.cover || item?.thumbnail || item?.thumb || PLACEHOLDER;
}

export default function RelatedList({ slug, title = "Похожие новости", limit = 6 }) {
  const [items, setItems] = useState(null); // null -> ещё не грузили; [] -> пусто
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    if (!slug) {
      setItems([]);
      setLoading(false);
      return;
    }

    // 1) мгновенный ответ из кеша (если есть и свежий)
    const cached = relatedCache.get(slug);
    const now = Date.now();
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      setItems(cached.items);
      setLoading(false);
      // Всё равно обновим из сети негромко (stale-while-revalidate)
      fetchRelated(slug)
        .then((data) => {
          if (!aliveRef.current) return;
          relatedCache.set(slug, { ts: Date.now(), items: data || [] });
          setItems((prev) => prev || data || []); // оставим текущее, если уже есть
        })
        .catch(() => {});
      return;
    }

    // 2) обычная загрузка
    setLoading(true);
    setErr(null);
    fetchRelated(slug)
      .then((data) => {
        if (!aliveRef.current) return;
        const list = Array.isArray(data) ? data : data?.results || [];
        relatedCache.set(slug, { ts: Date.now(), items: list });
        setItems(list);
      })
      .catch((e) => {
        if (!aliveRef.current) return;
        console.error("related error:", e);
        setErr("Не удалось загрузить похожие.");
        setItems([]);
      })
      .finally(() => {
        if (aliveRef.current) setLoading(false);
      });

    return () => {
      aliveRef.current = false;
    };
  }, [slug]);

  return (
    <section className={s.wrap} aria-busy={loading ? "true" : "false"}>
      <h3 className={s.title}>{title}</h3>

      {loading && (
        <div className={s.grid} role="status" aria-label="Загрузка похожих">
          {Array.from({ length: Math.min(limit, 6) }).map((_, i) => (
            <div className={s.card} key={`sk-${i}`}>
              <div className={s.skelThumb} />
              <div className={s.skelLine} />
              <div className={s.skelLineShort} />
            </div>
          ))}
        </div>
      )}

      {!loading && err && <div className={s.error}>{err}</div>}

      {!loading && !err && items && items.length > 0 && (
        <div className={s.grid}>
          {items.slice(0, limit).map((it) => {
            const url = buildArticleUrl(it);
            const img = pickImage(it);
            return (
              <Link className={s.card} to={url} key={`${it.slug}-${it.id || it.pk || it.url || url}`}>
                <div className={s.thumbWrap}>
                  <SmartMedia
                    src={img}
                    alt={it.title || "Новость"}
                    className={s.thumb}
                    loading="lazy"
                    imgProps={{ decoding: "async" }}
                    thumb={{ w: 420, h: 240, q: 82, fmt: "webp", fit: "cover" }}
                  />
                </div>
                <div className={s.cardTitle} title={it.title}>
                  {it.title || "Без названия"}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && !err && items && items.length === 0 && <div className={s.empty}>Похожих новостей не найдено.</div>}
    </section>
  );
}
