// Путь: frontend/src/components/zen/PublishDialog.jsx
// Назначение: Модал «Публикация»: выбор одной категории и обложки (из статьи или загрузка файла).
// Что внутри (полный файл):
//   • Парсинг изображений из EditorJS JSON и/или HTML (fallback).
//   • Галерея превью с выбором (radio-like), предпросмотр загруженного файла.
//   • Выбор единственной категории (native <select> без доп. зависимостей).
//   • Кнопки «Отмена» и «Опубликовать»; валидация выбора категории/обложки.
//   • Закрытие по ESC, клику вне модалки, блокировка скролла боди.

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./PublishDialog.css";

/** Утилита: аккуратно собираем все изображения из EditorJS JSON и HTML */
function collectImages({ contentJson, contentHtml, currentCover }) {
  const urls = new Set();

  // Текущее превью (если было выбрано в форме до модала)
  if (currentCover && typeof currentCover === "string") {
    urls.add(currentCover);
  }

  // Из EditorJS
  const blocks = Array.isArray(contentJson?.blocks) ? contentJson.blocks : [];
  for (const b of blocks) {
    if (!b) continue;
    if (b.type === "image") {
      const u = b.data?.file?.url || b.data?.url;
      if (u) urls.add(u);
    }
    if (b.type === "paragraph" || b.type === "header") {
      const t = b.data?.text || "";
      const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
      let m;
      while ((m = re.exec(t))) urls.add(m[1]);
    }
  }

  // Из HTML (когда Quill/фолбэк или просто для подстраховки)
  if (typeof contentHtml === "string" && contentHtml) {
    const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = re.exec(contentHtml))) urls.add(m[1]);
  }

  // Фильтрация мусора
  const arr = Array.from(urls).filter((u) => {
    if (!u) return false;
    if (u.startsWith("data:")) return false; // data-URL как обложку обычно не хотим
    return true;
  });

  return arr.slice(0, 60); // safety cap
}

export default function PublishDialog({
  open,
  onClose,
  onConfirm,
  categoriesList,
  initialCategories,      // массив id; возьмём первый, если есть
  currentCover,           // текущее превью
  contentJson,
  contentHtml,
}) {
  const [busy, setBusy] = useState(false);

  // Выбор категории (одна)
  const initialCategoryId =
    (Array.isArray(initialCategories) && initialCategories[0]) || "";
  const [categoryId, setCategoryId] = useState(initialCategoryId || "");

  // Кандидаты обложек из контента
  const imageCandidates = useMemo(
    () => collectImages({ contentJson, contentHtml, currentCover }),
    [contentJson, contentHtml, currentCover]
  );

  // Выбор обложки
  const [selectedUrl, setSelectedUrl] = useState(
    imageCandidates[0] || currentCover || ""
  );
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState("");

  // Закрытие по ESC, клик по фону; блокируем скролл боди
  const wrapRef = useRef(null);
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) {
      document.body.classList.add("zen-no-scroll");
      window.addEventListener("keydown", onKey);
    }
    return () => {
      document.body.classList.remove("zen-no-scroll");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  function onBackdropClick(e) {
    if (e.target === wrapRef.current) onClose?.();
  }

  function onPickFile(f) {
    if (!f) {
      setFile(null);
      setFilePreview("");
      return;
    }
    setFile(f);
    try {
      const url = URL.createObjectURL(f);
      setFilePreview(url);
    } catch {
      setFilePreview("");
    }
  }

  async function handleConfirm() {
    if (busy) return;
    if (!categoryId) {
      alert("Выберите категорию для публикации");
      return;
    }

    // Определяем источник обложки
    let cover = null;
    if (file) {
      cover = { kind: "file", file };
    } else if (selectedUrl) {
      cover = { kind: "url", url: selectedUrl };
    } else {
      // Разрешаем публиковать без обложки, если нужно — просто cover=null
      cover = null;
    }

    try {
      setBusy(true);
      await onConfirm?.({ categoryIds: [categoryId], cover });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="pd-backdrop" ref={wrapRef} onMouseDown={onBackdropClick}>
      <div className="pd-modal" role="dialog" aria-modal="true">
        <div className="pd-header">
          <div className="pd-title">Публикация</div>
          <button className="pd-close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        <div className="pd-body">
          {/* Категория */}
          <div className="pd-field">
            <label className="pd-label">Категория</label>
            <select
              className="pd-select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">— выберите категорию —</option>
              {categoriesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="pd-hint">Категория будет присвоена материалу при публикации.</div>
          </div>

          {/* Обложка: выбор из статьи */}
          <div className="pd-field">
            <label className="pd-label">Обложка из иллюстраций статьи</label>
            {imageCandidates.length === 0 ? (
              <div className="pd-empty">Подходящие изображения в статье не найдены.</div>
            ) : (
              <div className="pd-grid">
                {imageCandidates.map((url) => (
                  <button
                    key={url}
                    type="button"
                    className={"pd-thumb" + (selectedUrl === url && !file ? " is-active" : "")}
                    onClick={() => {
                      setFile(null);
                      setFilePreview("");
                      setSelectedUrl(url);
                    }}
                    title={url}
                  >
                    {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
                    <img src={url} alt="Кандидат обложки" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Обложка: загрузить файл */}
          <div className="pd-field">
            <label className="pd-label">Или загрузите новую обложку</label>
            <div className="pd-upload">
              <label className="pd-button">
                Загрузить файл
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                />
              </label>
              {file && (
                <button className="pd-ghost" onClick={() => onPickFile(null)}>
                  Очистить
                </button>
              )}
            </div>
            {filePreview && (
              <div className="pd-file-preview">
                {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
                <img src={filePreview} alt="Предпросмотр обложки" />
              </div>
            )}
            <div className="pd-hint">JPEG/PNG/WebP, желательно 1200×630 или больше.</div>
          </div>
        </div>

        <div className="pd-footer">
          <button className="pd-ghost" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button className="pd-accent" onClick={handleConfirm} disabled={busy}>
            {busy ? "Публикуем…" : "Опубликовать"}
          </button>
        </div>
      </div>
    </div>
  );
}
