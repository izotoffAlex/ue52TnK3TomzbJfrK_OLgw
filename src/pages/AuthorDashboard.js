// Путь: frontend/src/pages/AuthorDashboard.js
// Назначение: Кабинет автора (создание/редактирование статей + список).
//
// FIX 2026-02-08E (AUTHOR-CHANNEL-LINK-CANON):
// ✅ Каноническая ссылка на публичный "канал" автора теперь: /u/<channel_slug>/
//    - Это безопасно: не конфликтует с /:slug (категории).
//    - Если channel_slug не задан/не отдаётся — fallback на /author/<username|slug|id>/
// ✅ Ничего не ломает: это только генерация href.
//
// Важные изменения (как было ранее):
//   • МОДАЛКИ РАЗМОНТИРУЮТСЯ: {previewOpen && <PreviewModal .../>} и {publishOpen && <PublishDialog .../>}
//     — так никакой бекдроп не сможет накрыть поле, когда модалка закрыта.
//   • На инпуте заголовка оставлен контролируемый режим + autoSave.
// Прочее: логика сохранения/автосохранения/публикации не трогалась.
// Обновлено:
//   ✅ Добавлен Helmet (уникальные title/description для кабинета автора)
//   ✅ Уточнён description под SEO
//
// ДОБАВЛЕНО (2026-02-08D):
//   ✅ Кнопки:
//      - "Настройки канала" → /dashboard/author/channel/
//      - "Мой канал" → /u/<channel_slug>/ (или fallback /author/<key>/)

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import "./AuthorDashboard.css";
import ZenEditor from "../components/zen/ZenEditor";
import PreviewModal from "../components/zen/PreviewModal";
import PublishDialog from "../components/zen/PublishDialog";

import {
  listMyArticles as fetchMyArticles,
  createArticle,
  updateArticle,
  submitArticle,
  withdrawArticle,
  uploadAuthorImage,
  setArticleCover,
  getMyAuthorProfile,
} from "../api/dashboards";
import { fetchCategories } from "../Api";

const RU_STATUS = { draft: "Черновик", pending: "На модерации", published: "Опубликовано" };
const isDraft = (s) => s === "draft" || s === "Черновик";
const isPending = (s) => s === "pending" || s === "На модерации";

const LS_KEY = "authorDraft_v1";

/** Универсально достаём id из разных форм ответов бэкенда */
const pickId = (x) =>
  x?.id ??
  x?.pk ??
  x?.uuid ??
  x?.data?.id ??
  x?.data?.pk ??
  x?.article?.id ??
  x?.result?.id ??
  null;

function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return "";
}

export default function AuthorDashboard() {
  const [showForm, setShowForm] = useState(true);

  const [articles, setArticles] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);

  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");

  const [contentJson, setContentJson] = useState(null);
  const [contentHtml, setContentHtml] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const [autoSaveState, setAutoSaveState] = useState({ phase: "idle", ts: null });
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  const lastPayloadRef = useRef("");

  // ✅ профиль автора (best-effort) — нужен чтобы дать ссылку "Мой канал"
  const [myProfile, setMyProfile] = useState(null);

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const two = (n) => (n < 10 ? "0" + n : n);
    return `${two(d.getHours())}:${two(d.getMinutes())}`;
  };

  const loadArticles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMyArticles();
      const items = Array.isArray(data) ? data : data?.results || [];
      setArticles(items);
    } catch (e) {
      console.error(e);
      setError("Ошибка загрузки статей");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const data = await fetchCategories();
      setCategoriesList(Array.isArray(data) ? data : data?.results || []);
    } catch (e) {
      console.error("Ошибка категорий", e);
    }
  }, []);

  // ✅ загрузим профиль "me" (если ручки существуют) — не критично
  const loadMyProfile = useCallback(async () => {
    try {
      const p = await getMyAuthorProfile();
      setMyProfile(p || null);
    } catch {
      setMyProfile(null);
    }
  }, []);

  useEffect(() => {
    loadArticles();
    loadCategories();
    loadMyProfile();
  }, [loadArticles, loadCategories, loadMyProfile]);

  useEffect(() => {
    if (showForm) document.body.classList.add("zen-no-scroll");
    return () => document.body.classList.remove("zen-no-scroll");
  }, [showForm]);

  const samePayload = (payload) => {
    const snap = JSON.stringify(payload);
    if (snap === lastPayloadRef.current) return true;
    lastPayloadRef.current = snap;
    return false;
  };

  /** Создание/обновление. Возвращает надёжный ID. */
  const handleSave = useCallback(
    async (e, { forceDraft = false, forceCreate = false } = {}) => {
      e?.preventDefault?.();

      const payload = {
        title,
        body: contentHtml,
        content: contentHtml,
        content_html: contentHtml,
        content_json: contentJson ? JSON.stringify(contentJson) : null,
        meta_categories: categories,
        categories,
        tags,
        status: forceDraft ? "draft" : undefined,
        meta: { editor: "editorjs" },
      };

      // Если записи ещё нет — всегда создаём
      if (!editingId) {
        const created = await createArticle(payload);
        const newId = pickId(created);
        setArticles((prev) => (newId ? [{ ...(created || {}), id: newId }, ...prev] : prev));
        if (newId) setEditingId(newId);
        lastPayloadRef.current = JSON.stringify(payload);

        if (coverFile && newId) {
          try {
            await setArticleCover(newId, coverFile);
          } catch (err) {
            console.warn(err);
          }
        }
        await loadArticles();
        return newId;
      }

      // Есть запись: обновляем только при изменениях или при явном принуждении
      if (!forceCreate && samePayload(payload)) return editingId;

      const saved = await updateArticle(editingId, payload);
      const savedId = pickId(saved) || editingId;
      setArticles((prev) =>
        prev.map((it) => (pickId(it) === savedId ? { ...it, ...(saved || {}) } : it))
      );

      if (coverFile && savedId) {
        try {
          await setArticleCover(savedId, coverFile);
        } catch (err) {
          console.warn(err);
        }
      }
      await loadArticles();
      return savedId;
    },
    [editingId, title, contentHtml, contentJson, categories, tags, coverFile, loadArticles]
  );

  const autoSaveNow = useCallback(async () => {
    try {
      const d = { title, tags, categories, coverPreview, contentJson, contentHtml };
      localStorage.setItem(LS_KEY, JSON.stringify(d));
    } catch {}

    dirtyRef.current = true;
    if (savingRef.current) return;

    savingRef.current = true;
    setAutoSaveState({ phase: "saving", ts: Date.now() });

    try {
      // мягкий автосейв без принудительного создания
      if (editingId) {
        await handleSave(null, { forceDraft: true, forceCreate: false });
      }
      setAutoSaveState({ phase: "saved", ts: Date.now() });
    } catch {
      setAutoSaveState({ phase: "error", ts: Date.now() });
    } finally {
      savingRef.current = false;
      dirtyRef.current = false;
    }
  }, [editingId, title, tags, categories, coverPreview, contentJson, contentHtml, handleSave]);

  // Восстановление черновика из localStorage (если создаём НОВУЮ статью)
  useEffect(() => {
    if (!showForm || editingId) return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      setTitle(d.title || "");
      setTags(d.tags || []);
      setCategories(d.categories || []);
      setCoverPreview(d.coverPreview || "");
      setContentJson(d.contentJson || null);
      setContentHtml(d.contentHtml || "");
    } catch {}
  }, [showForm, editingId]);

  async function handleCancel() {
    try {
      await handleSave({ preventDefault() {} }, { forceDraft: true });
    } catch (e) {
      console.warn("Отмена: сохранить как черновик не удалось", e);
    } finally {
      resetForm();
    }
  }

  /** Публикация: надёжно получаем ID и только затем выставляем категории/обложку и submit */
  async function confirmPublish({ categoryIds, cover }) {
    try {
      // 1) пробуем получить ID от сохранения (с принуждением)
      let articleId = await handleSave(null, { forceCreate: true });

      // 2) fallback — текущий editingId
      if (!articleId) articleId = editingId;

      // 3) крайний случай — свежий список и подбор по заголовку
      if (!articleId) {
        const data = await fetchMyArticles();
        const items = Array.isArray(data) ? data : data?.results || [];
        const byTitle =
          items.find((it) => (it?.title || "").trim() === (title || "").trim()) || items[0] || null;
        articleId = pickId(byTitle);
      }

      if (!articleId) {
        alert("Не удалось определить ID статьи");
        return;
      }

      if (Array.isArray(categoryIds) && categoryIds.length) {
        await updateArticle(articleId, {
          meta_categories: categoryIds,
          categories: categoryIds,
        });
      }

      if (cover?.kind === "file" && cover.file) {
        await setArticleCover(articleId, cover.file);
      } else if (cover?.kind === "url" && cover.url) {
        try {
          await updateArticle(articleId, { cover: cover.url, cover_url: cover.url });
        } catch (e) {
          console.warn("Обновление обложки по URL не поддержано сервером:", e);
        }
      }

      await submitArticle(articleId);
      await loadArticles();
      alert("Отправлено на модерацию");
      setPublishOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      alert("Не удалось опубликовать");
    }
  }

  async function handleWithdrawArticle(id) {
    try {
      const res = await withdrawArticle(id);
      const newStatus = res?.status || "draft";
      setArticles((prev) => prev.map((a) => (pickId(a) === id ? { ...a, status: newStatus } : a)));
    } catch {
      setError("Не удалось отозвать статью");
    }
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setCategories([]);
    setTags([]);
    setCoverFile(null);
    setCoverPreview("");
    setContentJson(null);
    setContentHtml("");
    try {
      localStorage.removeItem(LS_KEY);
    } catch {}
  }

  // ===================== КАНОНИЧЕСКИЙ HREF "МОЙ КАНАЛ" =====================
  // ВАЖНО: /u/<channel_slug>/ — отдельное пространство имён, не конфликтует с /:slug (категории).
  // Фолбэки нужны, если бэк ещё не отдаёт channel_slug.
  const myChannelSlug =
    pickFirst(myProfile, ["channel_slug"]) ||
    pickFirst(myProfile?.channel, ["slug", "channel_slug"]) ||
    "";

  const myPublicKey =
    myChannelSlug ||
    pickFirst(myProfile, ["username", "slug"]) ||
    (myProfile?.id != null ? String(myProfile.id) : "");

  const myChannelHref = myChannelSlug
    ? `/u/${encodeURIComponent(myChannelSlug)}/`
    : myPublicKey
    ? `/author/${encodeURIComponent(myPublicKey)}/`
    : "/author/me";
  // =======================================================================

  if (showForm) {
    return (
      <>
        <Helmet>
          <title>Кабинет автора — IzotovLife</title>
          <meta
            name="description"
            content="Кабинет автора IzotovLife: создание и редактирование материалов, загрузка обложек, автосохранение черновиков и отправка статей на модерацию."
          />
        </Helmet>

        <div className="zen-shell">
          <header className="zen-header">
            <button type="button" className="zen-back" onClick={handleCancel}>
              ← К списку
            </button>

            <div className="zen-header-main">
              <div className="zen-header-title">Новая статья</div>

              <div className="zen-header-meta">
                {/* ✅ быстрые ссылки */}
                <Link className="btn btn--ghost" to="/dashboard/author/channel/">
                  Настройки канала
                </Link>
                <Link className="btn btn--ghost" to={myChannelHref}>
                  Мой канал
                </Link>

                <span className="zen-autosave">
                  {autoSaveState.phase === "idle" && "Изменения не сохранены"}
                  {autoSaveState.phase === "saving" && "Сохраняю…"}
                  {autoSaveState.phase === "saved" && `Сохранено ${formatTime(autoSaveState.ts)}`}
                  {autoSaveState.phase === "error" && "Ошибка сохранения"}
                </span>

                <button onClick={() => setPreviewOpen(true)} className="btn btn--ghost" type="button">
                  Предпросмотр
                </button>
                <button onClick={() => setPublishOpen(true)} className="btn btn--accent" type="button">
                  Опубликовать
                </button>
              </div>
            </div>
          </header>

          <div className="zen-workarea">
            <div className="zen-compose">
              <input
                type="text"
                placeholder="Заголовок"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  autoSaveNow();
                }}
                className="zen-title-input"
                required
                autoFocus
                autoComplete="off"
              />

              <ZenEditor
                initialJson={contentJson}
                initialHtml={contentHtml}
                onUploadImage={uploadAuthorImage}
                onChange={({ json, html }) => {
                  setContentJson(json);
                  setContentHtml(html);
                  autoSaveNow();
                }}
              />
            </div>
          </div>

          {/* ВАЖНО: модалки размонтируются, когда закрыты */}
          {previewOpen && (
            <PreviewModal
              open={previewOpen}
              onClose={() => setPreviewOpen(false)}
              title={title}
              cover={coverPreview}
              html={contentHtml}
              contentJson={contentJson}
            />
          )}

          {publishOpen && (
            <PublishDialog
              open={publishOpen}
              onClose={() => setPublishOpen(false)}
              categoriesList={categoriesList}
              initialCategories={categories}
              currentCover={coverPreview}
              contentJson={contentJson}
              contentHtml={contentHtml}
              onConfirm={confirmPublish}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Кабинет автора — IzotovLife</title>
        <meta
          name="description"
          content="Список авторских материалов на IzotovLife: черновики, статьи на модерации и уже опубликованные новости с возможностью вернуться к редактированию."
        />
      </Helmet>

      <div className="max-w-5xl mx-auto py-6 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h1 className="text-2xl font-bold">Кабинет автора</h1>

          <div className="flex gap-2 flex-wrap">
            <Link to="/dashboard/author/channel/" className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600">
              Настройки канала
            </Link>
            <Link to={myChannelHref} className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600">
              Мой канал
            </Link>

            <button
              onClick={() => setShowForm(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded"
            >
              Создать статью
            </button>
          </div>
        </div>

        {error && <div className="text-red-400 mb-4">{error}</div>}

        {loading ? (
          <div>Загрузка…</div>
        ) : articles.length === 0 ? (
          <div>У вас пока нет статей.</div>
        ) : (
          <ul className="space-y-3">
            {articles.map((a) => {
              const id = pickId(a);
              return (
                <li
                  key={id}
                  className="p-3 border border-gray-700 rounded bg-[var(--card-bg,#0f1420)]"
                >
                  <div className="flex justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{a.title}</h3>
                      <p className="text-sm text-gray-400">
                        Статус: {RU_STATUS[a.status] || a.status}
                      </p>
                    </div>
                    {(a.cover || a.cover_image || a.cover_url) && (
                      <img
                        src={a.cover || a.cover_image || a.cover_url}
                        alt="Обложка"
                        className="max-h-20 rounded object-cover"
                      />
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    {isDraft(a.status) && (
                      <>
                        <button
                          onClick={() => {
                            setShowForm(true);
                            setEditingId(id);
                            setTitle(a.title || "");
                            const meta = Array.isArray(a.meta_categories)
                              ? a.meta_categories
                              : Array.isArray(a.categories)
                              ? a.categories.map((c) => (typeof c === "object" ? c.id ?? c.slug ?? c : c))
                              : [];
                            setCategories(meta);

                            const tg = Array.isArray(a.tags)
                              ? a.tags
                              : typeof a.tags === "string"
                              ? a.tags
                                  .split(",")
                                  .map((x) => x.trim())
                                  .filter(Boolean)
                              : [];
                            setTags(tg);

                            const raw = a.content_json || a.body_json || null;
                            if (raw) {
                              try {
                                const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
                                setContentJson(parsed);
                                setContentHtml(a.body || a.content || "");
                              } catch {
                                setContentJson(null);
                                setContentHtml(a.body || a.content || "");
                              }
                            } else {
                              setContentJson(null);
                              setContentHtml(a.body || a.content || "");
                            }

                            setCoverFile(null);
                            setCoverPreview(a.cover || a.cover_image || a.cover_url || "");
                          }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded"
                        >
                          Редактировать
                        </button>

                        <button
                          onClick={async () => {
                            try {
                              await submitArticle(id);
                              await loadArticles();
                            } catch {
                              alert("Не удалось отправить");
                            }
                          }}
                          className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-black"
                        >
                          Отправить
                        </button>
                      </>
                    )}

                    {isPending(a.status) && (
                      <button
                        onClick={() => handleWithdrawArticle(id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded"
                      >
                        Отозвать
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
