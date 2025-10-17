// Путь: frontend/src/components/search/SearchAutocomplete.jsx
// Назначение: Поле поиска с автоподсказками для новостей.
// Исправлено (v5):
//   ✅ fetchSmartSearch заменён на searchAll (новый API).
//   ✅ Работает без /source/ в адресах.
//   ✅ Поддерживает debounce, AbortController и подсветку совпадений.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { searchAll } from "../../Api"; // ✅ заменено
import css from "./SearchAutocomplete.module.css";

// --- Вспомогательные функции формирования ссылок ---
function buildDetailHref(item) {
  const slug = item?.slug || item?.seo_slug || item?.url_slug;
  if (!slug) return "#";
  return `/news/${slug}/`; // ✅ без источников и категорий
}

export default function SearchAutocomplete() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const controllerRef = useRef(null);
  const navigate = useNavigate();

  // --- Закрытие при клике вне ---
  useEffect(() => {
    const onDocClick = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // --- Основной поиск с debounce и отменой старых запросов ---
  useEffect(() => {
    if (!query.trim()) {
      setItems([]);
      setOpen(false);
      if (controllerRef.current) controllerRef.current.abort();
      return;
    }

    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await searchAll(query.trim(), { limit: 10, signal: controller.signal });
        if (!controller.signal.aborted) {
          setItems(res.items || []);
          setOpen(true);
        }
      } catch (e) {
        if (e.name !== "AbortError") console.error("Ошибка поиска:", e);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250); // debounce 250 мс

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  // --- переход к первой найденной новости ---
  function onSubmit(e) {
    e.preventDefault();
    if (items.length) {
      const href = buildDetailHref(items[0]);
      if (href && href !== "#") {
        navigate(href);
        setOpen(false);
      }
    }
  }

  const list = useMemo(() => items.slice(0, 8), [items]);

  return (
    <div className={css.wrap} ref={boxRef}>
      <form onSubmit={onSubmit}>
        <input
          className={css.input}
          placeholder="Поиск новостей…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && items.length && setOpen(true)}
        />
      </form>

      {/* Выпадающий список результатов */}
      {open && (
        <div className={css.dropdown} role="listbox">
          {loading && <div className={css.loading}>Поиск…</div>}

          {!loading &&
            list.length > 0 &&
            list.map((it) => {
              const href = buildDetailHref(it);
              const titleHtml = it.highlighted_title || it.title || "Без названия";
              return (
                <Link
                  key={it.id || it.slug || Math.random()}
                  to={href}
                  className={css.item}
                  onClick={() => setOpen(false)}
                >
                  <div
                    className={css.title}
                    dangerouslySetInnerHTML={{ __html: titleHtml }}
                  />
                  <div className={css.meta}>
                    {it?.category?.name || it?.source_name || "Новости"}
                  </div>
                </Link>
              );
            })}

          {!loading && list.length === 0 && (
            <div className={css.empty}>Ничего не найдено</div>
          )}
        </div>
      )}
    </div>
  );
}
