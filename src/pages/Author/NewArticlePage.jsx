/* Путь: frontend/src/pages/Author/NewArticlePage.jsx
   Назначение: Страница «Новая статья». Заголовок без рамки, переносы, лимит 30 символов.
   Инлайн-стили убирают ЛЮБУЮ рамку/тень, даже если где-то в проекте есть более специфичные правила.
*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ZenEditor from "../../components/zen/ZenEditor";
import { ensureArticleId, updateDraft, publishArticle } from "../../api/authorArticles";
import "./NewArticlePage.css";

const MAX_TITLE_CHARS = 30;

export default function NewArticlePage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState(null);
  const [articleId, setArticleId] = useState(null);
  const [savingAt, setSavingAt] = useState(null);
  const [error, setError] = useState("");

  const savingRef = useRef(false);
  const titleRef = useRef(null);

  const autoResizeTitle = useCallback(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(() => { autoResizeTitle(); }, [autoResizeTitle]);

  const onTitleChange = useCallback((e) => {
    const next = e.target.value.slice(0, MAX_TITLE_CHARS); // двойная защита
    setTitle(next);
    autoResizeTitle();
  }, [autoResizeTitle]);

  const onEditorChange = useCallback((data) => setBody(data), []);

  const canPublish = useMemo(() => {
    const hasTitle = title.trim().length > 0;
    const hasBlocks = !!body?.blocks?.length;
    return hasTitle && hasBlocks && !savingRef.current;
  }, [title, body]);

  const onPublish = useCallback(async () => {
    setError("");
    try {
      if (!title.trim()) return setError("Добавьте заголовок.");
      if (!body?.blocks?.length) return setError("Добавьте текст статьи.");
      if (title.length > MAX_TITLE_CHARS) return setError(`До ${MAX_TITLE_CHARS} символов в заголовке.`);
      savingRef.current = true;

      const id = await ensureArticleId(articleId, { title: title.trim(), body_json: body });
      if (!articleId) setArticleId(id);

      await updateDraft(id, { title: title.trim(), body_json: body });
      await publishArticle(id);

      setSavingAt(new Date());
      savingRef.current = false;
      alert("Опубликовано!");
    } catch (e) {
      savingRef.current = false;
      console.error(e);
      setError(e?.response?.data?.detail || e?.message || "Не удалось опубликовать.");
    }
  }, [articleId, title, body]);

  // Диагностика: если на странице два редактора — выводим предупреждение в консоль
  useEffect(() => {
    const count = document.querySelectorAll(".codex-editor").length;
    if (count > 1) {
      console.warn(`Обнаружено ${count} экземпляров EditorJS на странице. Второй будет скрыт CSS.`);
    }
  });

  return (
    <div className="new-article">
      <header className="new-article__topbar">
        <div className="new-article__left">
          <textarea
            ref={titleRef}
            className="new-article__title"
            placeholder="Заголовок"
            value={title}
            rows={1}
            maxLength={MAX_TITLE_CHARS}
            onChange={onTitleChange}
            onInput={autoResizeTitle}
            onMouseDown={(e) => e.stopPropagation()}

            /* Инлайн-стили, чтобы точно убрать рамку/тень у заголовка */
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              boxShadow: "none",
            }}
          />
          <div className="new-article__meta">
            {savingAt ? `Сохранено ${savingAt.toLocaleTimeString()}` : `Черновик • ${title.length}/${MAX_TITLE_CHARS}`}
          </div>
        </div>

        <div className="new-article__right">
          <button className="new-article__publish" disabled={!canPublish} onClick={onPublish}>
            Опубликовать
          </button>
        </div>
      </header>

      {error && <div className="new-article__error">{error}</div>}

      <main className="new-article__main">
        <ZenEditor initialValue={body} onChange={onEditorChange} autofocus={false} />
      </main>
    </div>
  );
}
