// Путь: frontend/src/pages/AuthorChannelSettingsPage.js
// Назначение: Настройки канала автора (как Дзен) внутри личного кабинета.
//
// FIX 2026-02-08G (CABINET-DEFECTS + OPEN-CHANNEL):
// ✅ КРИТИЧЕСКИЙ ФИКС: CSS вынесен из JS (раньше был вставлен в конец файла и ломал сборку).
// ✅ Кнопка "Открыть канал" ведёт на канонический /u/<slug>/ и открывается в новой вкладке.
// ✅ Best-effort API: если в ../Api нет нужных экспортов или бэк не настроен — НЕ падаем.
// ✅ URL.createObjectURL() больше не течёт: revokeObjectURL в cleanup.
// ✅ Сообщение "Сохранено" выставляется корректно (без зависимости от устаревшего state note).
//
// Важно: Мы не ломаем бэк — 404/отсутствующие методы считаем нормальными для локалки.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

// ⚠️ Важно: импортируем весь модуль, чтобы НЕ падать, если каких-то экспортов нет.
import * as Api from "../Api";

function safeStr(v) {
  return String(v == null ? "" : v).trim();
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && safeStr(v)) return v;
  }
  return "";
}

function slugifySoft(s) {
  const v = safeStr(s)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return v;
}

function isHttpLike(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function hasFn(fn) {
  return typeof fn === "function";
}

export default function AuthorChannelSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // мягкое сообщение (например 404 — норм для локалки)
  const [note, setNote] = useState("");

  // фатальная ошибка (например 500)
  const [fatal, setFatal] = useState("");

  const [channelSlug, setChannelSlug] = useState("");
  const [channelTitle, setChannelTitle] = useState("");
  const [bio, setBio] = useState("");

  // URL fallback
  const [avatarUrl, setAvatarUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  // файлы upload
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  // превью
  const [avatarPreview, setAvatarPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");

  // чтобы не текли objectURL
  const lastAvatarObjectUrlRef = useRef("");
  const lastCoverObjectUrlRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setFatal("");
      setNote("");

      try {
        // Если функции нет — считаем это "не настроено"
        if (!hasFn(Api.getChannelSettings)) {
          const err = new Error("getChannelSettings is not implemented in Api");
          err.response = { status: 404 };
          throw err;
        }

        const data = await Api.getChannelSettings();
        if (cancelled) return;

        const s = pickFirst(data, ["channel_slug", "slug", "channel", "channelSlug"]);
        const t = pickFirst(data, ["channel_title", "title", "channelTitle", "name"]);
        const b = pickFirst(data, ["bio", "about", "description"]);

        const av = pickFirst(data, ["photo", "avatar", "image", "avatar_url", "photo_url"]);
        const cv = pickFirst(data, ["cover", "cover_image", "cover_url", "header", "banner"]);

        setChannelSlug(safeStr(s));
        setChannelTitle(safeStr(t));
        setBio(String(b || ""));

        setAvatarUrl(safeStr(av));
        setCoverUrl(safeStr(cv));

        setAvatarPreview(safeStr(av));
        setCoverPreview(safeStr(cv));
      } catch (e) {
        if (cancelled) return;
        const st = e?.response?.status;

        if (st === 404) {
          setNote(
            "API настроек канала пока не настроено на бэке (404 или не реализовано). Это нормально для локалки: задай slug и открой публичную страницу."
          );
        } else {
          setFatal(e?.message || "Не удалось загрузить настройки канала");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;

      // cleanup objectURL
      try {
        if (lastAvatarObjectUrlRef.current) URL.revokeObjectURL(lastAvatarObjectUrlRef.current);
      } catch {}
      try {
        if (lastCoverObjectUrlRef.current) URL.revokeObjectURL(lastCoverObjectUrlRef.current);
      } catch {}
      lastAvatarObjectUrlRef.current = "";
      lastCoverObjectUrlRef.current = "";
    };
  }, []);

  const normalizedSlug = useMemo(() => slugifySoft(channelSlug), [channelSlug]);

  const publicPath = useMemo(() => {
    if (!normalizedSlug) return "";
    // канонически /u/<slug>/
    return `/u/${encodeURIComponent(normalizedSlug)}/`;
  }, [normalizedSlug]);

  const publicAbsHref = useMemo(() => {
    if (!publicPath) return "";
    try {
      return new URL(publicPath, window.location.origin).toString();
    } catch {
      return publicPath;
    }
  }, [publicPath]);

  const origin = useMemo(() => {
    try {
      return window.location.origin;
    } catch {
      return "";
    }
  }, []);

  function setAvatarObjectPreview(file) {
    try {
      if (lastAvatarObjectUrlRef.current) URL.revokeObjectURL(lastAvatarObjectUrlRef.current);
    } catch {}
    lastAvatarObjectUrlRef.current = "";
    try {
      const u = URL.createObjectURL(file);
      lastAvatarObjectUrlRef.current = u;
      setAvatarPreview(u);
    } catch {}
  }

  function setCoverObjectPreview(file) {
    try {
      if (lastCoverObjectUrlRef.current) URL.revokeObjectURL(lastCoverObjectUrlRef.current);
    } catch {}
    lastCoverObjectUrlRef.current = "";
    try {
      const u = URL.createObjectURL(file);
      lastCoverObjectUrlRef.current = u;
      setCoverPreview(u);
    } catch {}
  }

  async function onSave(e) {
    e?.preventDefault?.();
    setFatal("");
    setNote("");

    const slugToSave = normalizedSlug || safeStr(channelSlug);

    if (!slugToSave) {
      setFatal("Укажи адрес страницы (slug). Например: izotoff");
      return;
    }

    setSaving(true);

    let savedOk = false;
    let hadSoftWarnings = false;

    try {
      if (!hasFn(Api.saveChannelSettings)) {
        const err = new Error("saveChannelSettings is not implemented in Api");
        err.response = { status: 404 };
        throw err;
      }

      await Api.saveChannelSettings({
        channel_slug: slugToSave,
        channel_title: safeStr(channelTitle),
        bio: bio || "",
        // url-fallback (если сервер игнорирует — ок)
        avatar_url: safeStr(avatarUrl),
        photo_url: safeStr(avatarUrl),
        cover_url: safeStr(coverUrl),
        cover_image_url: safeStr(coverUrl),
      });

      savedOk = true;

      // best-effort uploads (если ручки существуют)
      if (avatarFile) {
        if (hasFn(Api.uploadChannelAvatar)) {
          try {
            await Api.uploadChannelAvatar(avatarFile);
          } catch {
            hadSoftWarnings = true;
            setNote(
              "Текстовые поля сохранены. Загрузка аватара пока не поддерживается бэком (или эндпоинт отсутствует)."
            );
          }
        } else {
          hadSoftWarnings = true;
          setNote("Текстовые поля сохранены. Загрузка аватара не реализована в фронтенд Api.");
        }
      }

      if (coverFile) {
        if (hasFn(Api.uploadChannelCover)) {
          try {
            await Api.uploadChannelCover(coverFile);
          } catch {
            hadSoftWarnings = true;
            setNote(
              "Текстовые поля сохранены. Загрузка обложки пока не поддерживается бэком (или эндпоинт отсутствует)."
            );
          }
        } else {
          hadSoftWarnings = true;
          setNote("Текстовые поля сохранены. Загрузка обложки не реализована в фронтенд Api.");
        }
      }

      // обновим превью
      if (avatarFile) {
        setAvatarObjectPreview(avatarFile);
      } else if (isHttpLike(avatarUrl) || String(avatarUrl || "").startsWith("/")) {
        setAvatarPreview(avatarUrl);
      }

      if (coverFile) {
        setCoverObjectPreview(coverFile);
      } else if (isHttpLike(coverUrl) || String(coverUrl || "").startsWith("/")) {
        setCoverPreview(coverUrl);
      }

      // если не было мягких предупреждений — ставим "Сохранено."
      if (savedOk && !hadSoftWarnings) setNote("Сохранено.");
    } catch (e2) {
      const st = e2?.response?.status;
      if (st === 404) {
        setNote(
          "Сохранение пока не настроено на бэке (404 или не реализовано). Это нормально для локалки: slug можно использовать для открытия публичной страницы."
        );
      } else {
        setFatal(e2?.message || "Не удалось сохранить настройки");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Настройки канала — IzotovLife</title>
        <meta
          name="description"
          content="Настройки канала автора на IzotovLife: адрес страницы, название, описание, аватар и обложка."
        />
      </Helmet>

      <div className="max-w-5xl mx-auto py-6 px-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Канал</h1>
            <div className="text-sm text-gray-400">
              Настрой канал: slug, название, описание, аватар и обложку.
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link to="/dashboard/author/" className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600">
              ← В кабинет автора
            </Link>

            {publicPath ? (
              // ВАЖНО: в новой вкладке, чтобы не терять кабинет
              <a
                href={publicAbsHref}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700"
              >
                Открыть канал
              </a>
            ) : (
              <span className="px-3 py-2 rounded bg-gray-800 text-gray-400 cursor-not-allowed">
                Открыть канал
              </span>
            )}
          </div>
        </div>

        {loading && (
          <div className="p-4 border border-gray-700 rounded bg-[var(--card-bg,#0f1420)]">Загрузка…</div>
        )}

        {!loading && note && (
          <div className="mb-4 p-3 rounded border border-yellow-700 text-yellow-200 bg-black/30">
            {note}
          </div>
        )}

        {!loading && fatal && (
          <div className="mb-4 p-3 rounded border border-red-700 text-red-200 bg-black/30">{fatal}</div>
        )}

        {!loading && (
          <div className="border border-gray-700 rounded bg-[var(--card-bg,#0f1420)] overflow-hidden">
            {/* Обложка */}
            {coverPreview ? (
              <div className="w-full h-56 bg-black/20">
                <img src={coverPreview} alt="" className="w-full h-56 object-cover" />
              </div>
            ) : (
              <div className="w-full h-56 bg-black/20 flex items-center justify-center text-gray-500">
                Обложка не задана
              </div>
            )}

            <div className="p-4">
              {/* Аватар + URL */}
              <div className="flex items-center gap-4 mb-5">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt=""
                    className="w-20 h-20 rounded-full object-cover border border-gray-700"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-2xl border border-gray-700">
                    👤
                  </div>
                )}

                <div className="min-w-0">
                  <div className="text-sm text-gray-400">Публичный адрес:</div>
                  <div className="text-lg font-bold break-all">
                    {origin}/u/{normalizedSlug || "<адрес>"}/
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Сначала задай slug → появится кнопка «Открыть канал».
                  </div>
                </div>
              </div>

              <form onSubmit={onSave} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="font-semibold mb-2">Адрес страницы (URL)</div>
                    <input
                      className="w-full h-12 px-4 rounded bg-[#0b1220] border border-[#2b3551] outline-none"
                      value={channelSlug}
                      onChange={(e) => setChannelSlug(e.target.value)}
                      placeholder="например: izotoff"
                      autoComplete="off"
                    />
                    <div className="text-xs text-gray-400 mt-2">
                      Нормализация: <span className="font-mono">{normalizedSlug || "—"}</span>
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold mb-2">Название страницы</div>
                    <input
                      className="w-full h-12 px-4 rounded bg-[#0b1220] border border-[#2b3551] outline-none"
                      value={channelTitle}
                      onChange={(e) => setChannelTitle(e.target.value)}
                      placeholder="Например: IzotovLife — Авторские материалы"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div>
                  <div className="font-semibold mb-2">О себе</div>
                  <textarea
                    className="w-full px-4 py-3 rounded bg-[#0b1220] border border-[#2b3551] outline-none resize-y"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Короткое описание канала…"
                    rows={5}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="font-semibold mb-2">Аватар (файл)</div>
                    <input
                      className="w-full h-12 px-4 rounded bg-[#0b1220] border border-[#2b3551] outline-none"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                    />
                    <div className="text-xs text-gray-400 mt-2">
                      Если бэк не поддерживает загрузку — укажи URL ниже.
                    </div>

                    <div className="font-semibold mt-3 mb-2">Аватар (URL)</div>
                    <input
                      className="w-full h-12 px-4 rounded bg-[#0b1220] border border-[#2b3551] outline-none"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://… или /media/…"
                      autoComplete="off"
                    />
                  </div>

                  <div>
                    <div className="font-semibold mb-2">Обложка (файл)</div>
                    <input
                      className="w-full h-12 px-4 rounded bg-[#0b1220] border border-[#2b3551] outline-none"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                    />
                    <div className="text-xs text-gray-400 mt-2">
                      Если бэк не поддерживает загрузку — укажи URL ниже.
                    </div>

                    <div className="font-semibold mt-3 mb-2">Обложка (URL)</div>
                    <input
                      className="w-full h-12 px-4 rounded bg-[#0b1220] border border-[#2b3551] outline-none"
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="https://… или /media/…"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-3 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? "Сохраняю…" : "Сохранить настройки"}
                  </button>

                  {publicPath ? (
                    <a
                      href={publicAbsHref}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-3 rounded bg-gray-700 hover:bg-gray-600"
                    >
                      Перейти на канал
                    </a>
                  ) : (
                    <span className="px-4 py-3 rounded bg-gray-800 text-gray-400 cursor-not-allowed">
                      Перейти на канал
                    </span>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
