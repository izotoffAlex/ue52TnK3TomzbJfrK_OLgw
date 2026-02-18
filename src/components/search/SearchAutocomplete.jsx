// Путь: frontend/src/components/search/SearchAutocomplete.jsx
// Назначение: Поле поиска с автоподсказками (мобильная стабильность).
// Исправлено (ФИНАЛ):
//   ✅ dropdown НЕ закрывается при прокрутке пальцем
//   ✅ закрывается ТОЛЬКО при клике вне области
//   ✅ ровно 10 результатов
//   ✅ кнопка "Ещё…" → /search?q=...
//   ✅ pointerdown / touchstart / touchmove / wheel гасим внутри dropdown
//
// ДОБАВЛЕНО (2026-02-15-SEARCH-CATEGORY-URL):
//   ✅ Подсказки открываются по тем же правилам, что и страница поиска:
//      если у новости есть категория (category_slug / category.slug и т.п.),
//      используем путь /:category/:slug/, иначе — /news/:slug/ или /news/:id/.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { searchAll } from "../../Api";
import { extractSourceName } from "../../utils/source";
import css from "./SearchAutocomplete.module.css";

// ✅ ОБНОВЛЕНО: безопасный SEO-URL, учитывающий категорию
function buildDetailHref(item) {
  if (!item || typeof item !== "object") return "/news/";

  // slug новости из разных возможных полей
  const slug =
    item.slug ||
    item.news_slug ||
    item.article_slug ||
    item.seo_slug ||
    item.url_slug ||
    null;

  // slug категории из разных возможных структур
  const categorySlug =
    item.category_slug ||
    item.categorySlug ||
    (item.category && item.category.slug) ||
    (item.category_obj && item.category_obj.slug) ||
    (item.category_fk && item.category_fk.slug) ||
    null;

  // Если есть и категория, и slug → /:category/:slug/
  if (categorySlug && slug) {
    return `/${encodeURIComponent(String(categorySlug))}/${encodeURIComponent(
      String(slug)
    )}/`;
  }

  // Если категории нет, но есть slug → старый путь /news/:slug/
  if (slug) {
    return `/news/${encodeURIComponent(String(slug))}/`;
  }

  // Фолбэк по id → /news/:id/
  const id = item.id ?? item.pk ?? item.uuid ?? null;
  if (id !== null && id !== undefined && String(id).trim() !== "") {
    return `/news/${encodeURIComponent(String(id))}/`;
  }

  // Самый безопасный фолбэк
  return "/news/";
}

const PREVIEW_LIMIT = 10;

export default function SearchAutocomplete() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const boxRef = useRef(null);
  const controllerRef = useRef(null);
  const navigate = useNavigate();

  // ✅ Закрытие ТОЛЬКО при клике вне компонента
  useEffect(() => {
    const onPointerDown = (e) => {
      if (!boxRef.current) return;
      if (boxRef.current.contains(e.target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // 🔍 Поиск с debounce
  useEffect(() => {
    if (!query.trim()) {
      setItems([]);
      setOpen(false);
      controllerRef.current?.abort();
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await searchAll(query.trim(), {
          limit: PREVIEW_LIMIT,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setItems(Array.isArray(res.items) ? res.items : []);
          setOpen(true);
        }
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("Ошибка поиска:", e);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  function onSubmit(e) {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
  }

  const list = useMemo(() => items.slice(0, PREVIEW_LIMIT), [items]);

  // 🔒 универсальный гаситель событий
  const stop = (e) => e.stopPropagation();

  return (
    <div
      className={css.wrap}
      ref={boxRef}
      onPointerDown={stop}
      onTouchStart={stop}
      onTouchMove={stop}
      onWheel={stop}
    >
      <form onSubmit={onSubmit}>
        <input
          className={css.input}
          placeholder="Поиск новостей…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
        />
      </form>

      {open && (
        <div
          className={css.dropdown}
          role="listbox"
          onPointerDown={stop}
          onTouchStart={stop}
          onTouchMove={stop}
          onWheel={stop}
        >
          {loading && <div className={css.loading}>Поиск…</div>}

          {!loading &&
            list.map((it) => {
              const href = buildDetailHref(it);
              const titleHtml = it.highlighted_title || it.title || "Без названия";
              const source = extractSourceName(it);

              return (
                <Link
                  key={it.id || it.slug}
                  to={href}
                  className={css.item}
                  onClick={() => setOpen(false)}
                >
                  <div
                    className={css.title}
                    dangerouslySetInnerHTML={{ __html: titleHtml }}
                  />
                  <div className={css.meta}>{source}</div>
                </Link>
              );
            })}

          {!loading && list.length === 0 && (
            <div className={css.empty}>Ничего не найдено</div>
          )}

          {!loading && items.length >= PREVIEW_LIMIT && (
            <button
              type="button"
              className={css.item}
              onClick={() => {
                navigate(`/search?q=${encodeURIComponent(query.trim())}`);
                setOpen(false);
              }}
            >
              Показать все результаты →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
