// Путь: frontend/src/pages/SearchPage.js
// Назначение: Страница поиска новостей (ускоренная, адаптированная под темы, без артефактов меню).
// Обновление:
// ✅ Использует компонент NewsCard (единый стиль карточек, корректный вывод источника и SEO-ссылок)
// ✅ Сохранилась подгрузка, дебаунс и очистка оверлеев
// ✅ Убраны лишние дублирующие шаблоны

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchAll } from "../Api";
import NewsCard from "../components/NewsCard";
import s from "./SearchPage.module.css";

// ---- Вспомогательные ----
function SkeletonCard() {
  return (
    <div className={s["search-card"]}>
      <div className={`${s.skeleton}`} style={{ height: 160, width: "100%" }} />
      <div className={s["card-body"]}>
        <div className={s.skeleton} style={{ height: 14, width: "60%" }} />
        <div className={s.skeleton} style={{ height: 20, width: "90%" }} />
        <div className={s.skeleton} style={{ height: 16, width: "80%" }} />
      </div>
    </div>
  );
}

// ---- Основной компонент ----
export default function SearchPage() {
  const [sp] = useSearchParams();
  const q = (sp.get("q") || "").trim();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const limit = 30;
  const [page, setPage] = useState(1);
  const offset = useMemo(() => (page - 1) * limit, [page]);
  const loaderRef = useRef(null);
  const controllerRef = useRef(null);

  // ✅ Жёстко закрываем любые выезжающие меню/оверлеи
  useEffect(() => {
    const selectors = [
      ".mobile-menu",
      ".menu-overlay",
      ".nav-overlay",
      ".navbar-overlay",
      ".menu-backdrop",
      ".menu-drawer",
      ".navbar-drawer",
      ".burger-menu",
      ".overlay",
    ];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.classList.remove("open", "active", "show", "visible");
        el.setAttribute("aria-hidden", "true");
        el.style.display = "none";
      });
    });
    ["menu-open", "no-scroll", "overflow-hidden", "lock"].forEach((cls) => {
      document.body.classList.remove(cls);
      document.documentElement.classList.remove(cls);
    });
    const closeBtn =
      document.querySelector("[data-close]") ||
      document.querySelector(".menu-close, .navbar-close, .burger-close");
    if (closeBtn) {
      try {
        closeBtn.click();
      } catch {}
    }
  }, []);

  // Сброс при новом запросе
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [q]);

  // Загрузка результатов
  useEffect(() => {
    if (!q) {
      setItems([]);
      setTotal(0);
      return;
    }

    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await searchAll(q, { limit, offset, signal: controller.signal });
        if (!cancelled && !controller.signal.aborted) {
          const newItems = Array.isArray(data.items) ? data.items : data.results || [];
          setItems((prev) => (page === 1 ? newItems : [...prev, ...newItems]));
          setTotal(data.total ?? newItems.length ?? 0);
        }
      } catch (e) {
        if (!cancelled && e.name !== "AbortError") {
          setErr(e?.message || "Ошибка загрузки результатов");
        }
      } finally {
        if (!cancelled && !controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, offset, page, limit]);

  // Бесконечная подгрузка
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && items.length < total) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loading, items, total]);

  return (
    <main className={s["search-page"]}>
      <h1>Поиск</h1>
      <div className={s["search-info"]}>
        Запрос: <b>{q || "—"}</b> {total ? <span>(найдено: {total})</span> : null}
      </div>

      {err && <div className={s.error}>Ошибка: {err}</div>}
      {!loading && !err && q && total === 0 && <div>Ничего не найдено.</div>}
      {!q && <div>Введите запрос в строке поиска выше.</div>}

      <div className={s["search-grid"]}>
        {items.map((it, idx) => (
          <NewsCard key={`${it.id ?? it.slug ?? idx}-${idx}`} item={it} />
        ))}
        {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>

      {items.length < total && !loading && <div ref={loaderRef} />}
    </main>
  );
}
