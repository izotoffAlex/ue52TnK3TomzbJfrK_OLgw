// Путь: frontend/src/components/Footer.js
// Назначение: футер IzotovLife, который автоматически подхватывает СТАТИЧЕСКИЕ СТРАНИЦЫ из админки (Pages)
// через API /api/pages/ и показывает их в футере.
// Изменения (2026-01-03):
//   ✅ Убрали жёсткий список mandatoryPages — футер живёт от админки на 100%
//   ✅ Поддержка DRF-пагинации (results)
//   ✅ Фильтрация по published/is_published/is_active (если поле есть) — снял "Опубликовано" → ссылка исчезла
//   ✅ Фолбэк: если fetchPages() не сработал, пробуем /api/pages/ напрямую
//   ✅ Дедупликация по slug и сортировка: сначала “важные” (если есть), потом остальные по алфавиту

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPages } from "../Api";
import "./Footer.css";

function normalizePagesPayload(payload) {
  // DRF может вернуть: [ ... ] или { results: [ ... ] }
  const arr = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
    ? payload.results
    : [];

  return arr
    .map((p) => {
      const slug = (p?.slug || p?.code || "").toString().trim();
      const title = (p?.title || p?.name || p?.heading || "").toString().trim();

      // разные варианты полей "опубликовано" (если API отдаёт)
      const publishedLike =
        typeof p?.published === "boolean"
          ? p.published
          : typeof p?.is_published === "boolean"
          ? p.is_published
          : typeof p?.is_active === "boolean"
          ? p.is_active
          : true; // если поля нет — считаем, что можно показывать (часто API уже фильтрует опубликованные)

      return {
        id: p?.id ?? slug,
        slug,
        title,
        publishedLike,
        footerOrder:
          typeof p?.footer_order === "number"
            ? p.footer_order
            : typeof p?.order === "number"
            ? p.order
            : typeof p?.position === "number"
            ? p.position
            : null,
      };
    })
    .filter((p) => p.slug && p.title && p.publishedLike);
}

async function tryFetchJson(url) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function loadPagesSmart() {
  // 1) Сначала — штатный метод проекта
  try {
    const data = await fetchPages();
    const normalized = normalizePagesPayload(data);
    if (normalized.length) return normalized;
  } catch (e) {
    console.warn("Footer: fetchPages() не сработал, пробуем /api/pages/:", e);
  }

  // 2) Фолбэк — прямой запрос (у тебя он ТОЧНО существует)
  const candidates = ["/api/pages/", "/api/pages/?page_size=200"];

  for (const url of candidates) {
    try {
      const data = await tryFetchJson(url);
      const normalized = normalizePagesPayload(data);
      if (normalized.length) return normalized;
    } catch (e) {
      // пробуем следующий
    }
  }

  return [];
}

export default function Footer() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const items = await loadPagesSmart();
        if (!alive) return;
        setPages(items);
      } catch (err) {
        console.error("Footer: ошибка загрузки страниц:", err);
        if (!alive) return;
        setPages([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const orderedPages = useMemo(() => {
    const preferredOrder = [
      "politika-konfidencialnosti",
      "pravila-ispolzovaniya",
      "pravoobladatelyam",
      "o-kompanii",
      "redakcionnaya-politika",
      "reklama",
      "kontakty",
      "politika-cookie",
      "cookies",
      "cookie",
    ];

    // дедуп по slug
    const map = new Map();
    for (const p of pages) {
      if (!map.has(p.slug)) map.set(p.slug, p);
    }
    const uniq = Array.from(map.values());

    const hasFooterOrder = uniq.some((p) => typeof p.footerOrder === "number");

    uniq.sort((a, b) => {
      // 1) footerOrder (если есть)
      if (hasFooterOrder) {
        const ao = typeof a.footerOrder === "number" ? a.footerOrder : 99999;
        const bo = typeof b.footerOrder === "number" ? b.footerOrder : 99999;
        if (ao !== bo) return ao - bo;
      }

      // 2) preferredOrder
      const ai = preferredOrder.indexOf(a.slug);
      const bi = preferredOrder.indexOf(b.slug);
      const aRank = ai === -1 ? 999 : ai;
      const bRank = bi === -1 ? 999 : bi;
      if (aRank !== bRank) return aRank - bRank;

      // 3) алфавит
      return a.title.localeCompare(b.title, "ru", { sensitivity: "base" });
    });

    return uniq;
  }, [pages]);

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <nav className="site-footer__links">
          {loading && (
            <span className="site-footer__loading">Загружаем страницы…</span>
          )}

          {!loading && orderedPages.length === 0 && (
            <span className="site-footer__loading">
              Страницы не найдены (проверь API /api/pages/ и публикацию страниц в админке)
            </span>
          )}

          {!loading &&
            orderedPages.map((p) => (
              <Link key={p.id || p.slug} to={`/pages/${p.slug}`}>
                {p.title}
              </Link>
            ))}
        </nav>

        <div className="site-footer__bottom">
          <div className="site-footer__copy">
            © {new Date().getFullYear()} IzotovLife.ru
          </div>

          <div className="site-footer__legal">
            Авторские материалы IzotovLife защищены законодательством об авторском праве.
            Права на материалы, полученные из RSS-лент, принадлежат их правообладателям.
            IzotovLife отображает анонсы публикаций, предоставляемые сайтами-источниками.
          </div>
        </div>
      </div>
    </footer>
  );
}
