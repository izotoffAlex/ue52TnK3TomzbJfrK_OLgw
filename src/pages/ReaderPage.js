// Путь: frontend/src/pages/ReaderPage.js
// Назначение: Личный кабинет читателя: вкладки "Избранное / Мои статьи / Настройки".
//
// FIX 2026-02-08I (FULL-WIDTH + CREATE-ARTICLE + OPEN-CHANNEL):
// ✅ Кабинет больше не "сдавлен": карточка и контейнер растягиваются на всю ширину.
// ✅ Во вкладке "Мои статьи" добавлены кнопки:
//    - "Создать статью" → /dashboard/author/new/
//    - "Открыть канал" (канонический /u/<slug>/) в новой вкладке
// ✅ Если slug не задан — показываем кнопку "Задать slug" (переключает на "Настройки").
// ✅ "Мои статьи" остаётся best-effort (404 на локалке не считается фатальной ошибкой).
//
// Важно:
// - ReaderPage.module.css используется как прежде, но мы добавили inline-style, чтобы
//   гарантированно растянуть блок (даже если в CSS есть max-width).

import React from "react";
import { Link } from "react-router-dom";
import styles from "./ReaderPage.module.css";
import { tryGet, tryPost, whoami } from "../Api";

function normalizeSlugInput(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildPublicChannelHref(slug) {
  const s = String(slug || "").trim();
  if (!s) return "";
  return `/u/${encodeURIComponent(s.replace(/^\/+|\/+$/g, ""))}/`;
}

function isHttpOrRelative(u) {
  if (!u) return false;
  const s = String(u).trim();
  return s.startsWith("/") || /^https?:\/\//i.test(s);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return "";
}

function buildAuthorArticleHref(a) {
  const slug = pickFirst(a, ["slug", "article_slug", "post_slug"]);
  const author =
    pickFirst(a, ["author_login", "author_username", "username", "login"]) ||
    pickFirst(a?.author, ["login", "username", "slug", "name"]);

  if (author && slug) {
    return `/articles/${encodeURIComponent(String(author))}/${encodeURIComponent(String(slug))}/`;
  }

  const url = pickFirst(a, ["url", "absolute_url", "href"]);
  if (url && String(url).startsWith("/")) return url;

  return "";
}

export default function ReaderPage() {
  const [activeTab, setActiveTab] = React.useState("my"); // по скрину у тебя чаще "Мои статьи"
  const [me, setMe] = React.useState(null);

  // --- Канал ---
  const [channelSlug, setChannelSlug] = React.useState("");
  const [channelTitle, setChannelTitle] = React.useState("");
  const [channelBio, setChannelBio] = React.useState("");
  const [channelAvatarUrl, setChannelAvatarUrl] = React.useState("");

  const [loading, setLoading] = React.useState(true);
  const [softNote, setSoftNote] = React.useState("");
  const [error, setError] = React.useState("");

  const publicHref = buildPublicChannelHref(channelSlug);

  // --- Мои статьи ---
  const [myLoading, setMyLoading] = React.useState(false);
  const [mySoft, setMySoft] = React.useState("");
  const [myError, setMyError] = React.useState("");
  const [myArticles, setMyArticles] = React.useState([]);

  // кандидаты "Мои статьи" (без /api, потому что tryGet добавляет базовый префикс сам)
  const MY_ARTICLES_ENDPOINTS = React.useMemo(
    () => [
      "/articles/my/",
      "/articles/mine/",
      "/articles/?mine=1",
      "/author/articles/my/",
      "/accounts/my/articles/",
    ],
    []
  );

  // ------------------ LOAD: whoami + best-effort channel settings ------------------
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      setSoftNote("");

      // whoami
      try {
        const w = await whoami();
        if (!cancelled) setMe(w || null);
      } catch {
        if (!cancelled) setMe(null);
      }

      // best-effort channel settings
      try {
        const r = await tryGet(
          ["/auth/settings/", "/accounts/settings/", "/accounts/channel/", "/users/settings/"],
          { headers: { Accept: "application/json" } }
        );

        const data = r?.data || {};
        if (cancelled) return;

        const slug = data.channel_slug || data.slug || data.channel?.slug || "";
        const title = data.channel_title || data.title || data.channel?.title || "";
        const bio =
          data.bio ||
          data.description ||
          data.channel?.bio ||
          data.channel?.description ||
          "";
        const avatar =
          data.avatar ||
          data.photo ||
          data.image ||
          data.channel?.avatar ||
          data.channel?.photo ||
          data.channel?.image ||
          "";

        setChannelSlug(String(slug || ""));
        setChannelTitle(String(title || ""));
        setChannelBio(String(bio || ""));
        setChannelAvatarUrl(String(avatar || ""));
      } catch (e) {
        if (cancelled) return;

        const st = e?.response?.status;
        if (st === 404 || st === 405) {
          setSoftNote(
            "API настроек канала пока не настроено на локальном бэке (404). Это нормально: " +
              "задай slug в «Настройки» — и откроется публичная страница канала."
          );
        } else {
          setSoftNote("Не удалось загрузить настройки канала (best-effort).");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------ LOAD MY ARTICLES ------------------
  React.useEffect(() => {
    let cancelled = false;

    async function loadMy() {
      if (activeTab !== "my") return;

      setMyLoading(true);
      setMyError("");
      setMySoft("");

      try {
        const r = await tryGet(MY_ARTICLES_ENDPOINTS, { headers: { Accept: "application/json" } });
        const data = r?.data;

        const items = Array.isArray(data)
          ? data
          : safeArray(data?.results) || safeArray(data?.items);

        if (cancelled) return;

        setMyArticles(items);

        if (!items || items.length === 0) {
          setMySoft("Пока нечего показывать.");
        }
      } catch (e) {
        if (cancelled) return;

        const st = e?.response?.status;
        if (st === 404 || st === 405) {
          setMySoft(
            "API «Мои статьи» пока не настроено на локальном бэке (404). " +
              "На проде это будет работать, а локально нужно подключить нужный эндпоинт."
          );
        } else if (st === 401 || st === 403) {
          setMySoft("Нет доступа к «Мои статьи» (401/403). Проверь авторизацию.");
        } else {
          setMyError(e?.message || "Не удалось загрузить «Мои статьи»");
        }
      } finally {
        if (!cancelled) setMyLoading(false);
      }
    }

    loadMy();

    return () => {
      cancelled = true;
    };
  }, [activeTab, MY_ARTICLES_ENDPOINTS]);

  // ------------------ SAVE CHANNEL SETTINGS ------------------
  async function onSaveChannel(e) {
    e?.preventDefault?.();
    setError("");
    setSoftNote("");

    const payload = {
      channel_slug: String(channelSlug || "").trim(),
      channel_title: String(channelTitle || "").trim(),
      bio: String(channelBio || "").trim(),
      avatar: isHttpOrRelative(channelAvatarUrl) ? channelAvatarUrl.trim() : "",
    };

    try {
      await tryPost(["/auth/settings/", "/accounts/settings/", "/accounts/channel/"], payload);
      setSoftNote("Настройки канала сохранены.");
    } catch (e2) {
      const st = e2?.response?.status;
      if (st === 404 || st === 405) {
        setSoftNote(
          "Сохранение настроек канала пока недоступно (API отсутствует на бэке). " +
            "Но публичную страницу открыть можно — по slug."
        );
        return;
      }
      setError(e2?.message || "Не удалось сохранить настройки");
    }
  }

  // ------------------ UI: TAB BUTTON ------------------
  const TabBtn = ({ id, children }) => (
    <button
      type="button"
      className={id === activeTab ? "px-4 py-2 rounded bg-blue-600" : "px-4 py-2 rounded bg-white/10"}
      onClick={() => setActiveTab(id)}
    >
      {children}
    </button>
  );

  // ------------------ RENDER MY ARTICLES ------------------
  function renderMyArticles() {
    return (
      <div style={{ padding: 12 }}>
        {/* Верхние действия вкладки */}
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 900 }}>Мои статьи</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link
              to="/dashboard/author/new/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 900,
                background: "#16a34a",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              + Создать статью
            </Link>

            {publicHref ? (
              <a
                href={publicHref}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontWeight: 900,
                  background: "#1d4ed8",
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                Открыть канал
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab("settings")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontWeight: 900,
                  background: "rgba(255,255,255,0.10)",
                  color: "inherit",
                  border: "1px solid rgba(255,255,255,0.10)",
                  cursor: "pointer",
                }}
                title="Сначала задай slug в настройках канала"
              >
                Задать slug → открыть канал
              </button>
            )}
          </div>
        </div>

        {myLoading ? <div style={{ opacity: 0.85 }}>Загрузка…</div> : null}

        {myError ? <div className={styles.error}>Ошибка: {myError}</div> : null}

        {mySoft ? (
          <div
            className={styles.error}
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              borderColor: "rgba(245, 158, 11, 0.28)",
              color: "#fde68a",
              marginBottom: 12,
            }}
          >
            {mySoft}
          </div>
        ) : null}

        {myArticles.length === 0 ? (
          <div style={{ opacity: 0.85 }}>Пока нечего показывать.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {myArticles.map((a, idx) => {
              const title = pickFirst(a, ["title", "name", "headline"]) || "Без названия";
              const dt = pickFirst(a, ["published_at", "created_at", "date", "created"]) || "";
              const href = buildAuthorArticleHref(a);

              const Card = (
                <div
                  style={{
                    borderRadius: 14,
                    padding: 14,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1.2 }}>{title}</div>
                  {dt ? <div style={{ opacity: 0.75, marginTop: 6 }}>{dt}</div> : null}
                </div>
              );

              return href ? (
                <Link
                  key={String(a?.id ?? idx)}
                  to={href}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {Card}
                </Link>
              ) : (
                <div key={String(a?.id ?? idx)}>{Card}</div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ------------------ RENDER ------------------
  return (
    <div
      className={styles.page}
      style={{
        width: "100%",
        maxWidth: "100%",
      }}
    >
      <div
        className={styles.card}
        style={{
          width: "100%",
          maxWidth: "100%",
        }}
      >
        {/* Шапка */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1 }}>Личный кабинет</div>
          <div style={{ opacity: 0.85, marginTop: 6 }}>
            {me?.email || me?.user?.email || me?.username || "—"}
          </div>
        </div>

        {/* Вкладки */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <TabBtn id="favorites">Избранное</TabBtn>
          <TabBtn id="my">Мои статьи</TabBtn>
          <TabBtn id="settings">Настройки</TabBtn>
        </div>

        {/* Контент */}
        {activeTab === "favorites" ? (
          <div style={{ padding: 12, opacity: 0.85 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Избранное</div>
            <div style={{ fontSize: 14 }}>
              Пришли код реализации “Избранного” — подключу корректный вывод.
            </div>
          </div>
        ) : activeTab === "my" ? (
          renderMyArticles()
        ) : (
          <>
            <h2 className={styles.title} style={{ textAlign: "left", marginBottom: 10 }}>
              Настройки
            </h2>

            {softNote ? (
              <div
                className={styles.error}
                style={{
                  background: "rgba(245, 158, 11, 0.12)",
                  borderColor: "rgba(245, 158, 11, 0.28)",
                  color: "#fde68a",
                }}
              >
                {softNote}
              </div>
            ) : null}

            {error ? <div className={styles.error}>Ошибка: {error}</div> : null}

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Канал</div>

              <form className={styles.form} onSubmit={onSaveChannel}>
                <div className={styles.field}>
                  <div className={styles.label}>Адрес страницы (URL)</div>
                  <input
                    className={styles.input}
                    style={{ width: "100%" }}
                    value={channelSlug}
                    onChange={(e) => setChannelSlug(normalizeSlugInput(e.target.value))}
                    placeholder="например: izotoff"
                    autoComplete="off"
                  />

                  <div className={styles.footer}>
                    Итоговый адрес будет:{" "}
                    <span style={{ fontWeight: 900 }}>
                      {(typeof window !== "undefined" ? window.location.origin : "https://izotovlife.ru") +
                        (publicHref || "/u/<адрес>/")}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                    {publicHref ? (
                      <a
                        href={publicHref}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "12px 14px",
                          borderRadius: 14,
                          fontWeight: 900,
                          background: "#1d4ed8",
                          color: "#fff",
                          textDecoration: "none",
                        }}
                      >
                        Открыть публичную страницу
                      </a>
                    ) : (
                      <div style={{ fontSize: 14, opacity: 0.8 }}>
                        Задай slug, чтобы открыть публичную страницу.
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.field}>
                  <div className={styles.label}>Название страницы</div>
                  <input
                    className={styles.input}
                    style={{ width: "100%" }}
                    value={channelTitle}
                    onChange={(e) => setChannelTitle(e.target.value)}
                    placeholder="Например: IzotovLife — Авторские материалы"
                  />
                </div>

                <div className={styles.field}>
                  <div className={styles.label}>О себе</div>
                  <textarea
                    className={styles.input}
                    style={{ width: "100%", height: 140, paddingTop: 14, resize: "vertical" }}
                    value={channelBio}
                    onChange={(e) => setChannelBio(e.target.value)}
                    placeholder="Короткое описание канала…"
                  />
                </div>

                <div className={styles.field}>
                  <div className={styles.label}>Аватар (URL)</div>
                  <input
                    className={styles.input}
                    style={{ width: "100%" }}
                    value={channelAvatarUrl}
                    onChange={(e) => setChannelAvatarUrl(e.target.value)}
                    placeholder="https://... или /media/..."
                  />
                  <div className={styles.footer}>
                    (Если на бэке ещё нет загрузки файла — можно временно использовать URL)
                  </div>
                </div>

                <button type="submit" className={styles.submit} disabled={loading}>
                  Сохранить настройки
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
