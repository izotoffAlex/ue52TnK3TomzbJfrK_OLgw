// Путь: frontend/src/pages/EditorDashboard.js
// Назначение: Кабинет редактора/модерации.
// Фикс:
//   ✅ Убраны условные вызовы хуков (React Hooks must be called unconditionally).
//   ✅ Используются совместимые функции API: listPendingSubmissions, decideSubmission.
//   ✅ Исправлен no-undef: импортирован api для editorial-comment.
// Важно:
//   - Этот файл нужен, чтобы сборка не падала, даже если роль "редактор" позже будет отключена.

import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { decideSubmission, listPendingSubmissions } from "../api/dashboards";
import api from "../Api"; // добавлено: клиент API для editorial-comment

function getId(item) {
  return item?.id ?? item?.pk ?? item?.submission_id ?? item?._id ?? null;
}

export default function EditorDashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function reload() {
    setError("");
    setLoading(true);
    try {
      const data = await listPendingSubmissions();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
      setError(e?.detail || e?.message || "Не удалось загрузить очередь модерации");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPublish(item) {
    const id = getId(item);
    if (!id) return;
    setBusyId(id);
    setError("");
    try {
      await decideSubmission(id, "publish");
      await reload();
    } catch (e) {
      setError(e?.detail || e?.message || "Ошибка публикации");
    } finally {
      setBusyId(null);
    }
  }

  async function onChanges(item) {
    const id = getId(item);
    if (!id) return;

    const message = window.prompt("Какие правки нужны? (Сообщение автору)", "") || "";
    if (!message.trim()) {
      setError("Нужно написать сообщение автору (что исправить).");
      return;
    }

    setBusyId(id);
    setError("");
    try {
      await decideSubmission(id, "changes", message.trim());
      await reload();
    } catch (e) {
      setError(e?.detail || e?.message || "Ошибка запроса правок");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Helmet>
        <title>Модерация — IzotovLife</title>
        <meta name="description" content="Очередь статей на модерации." />
      </Helmet>

      <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 12px" }}>
        <h1 style={{ margin: "8px 0 16px" }}>Модерация</h1>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <button
            onClick={reload}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "#fff",
              cursor: loading ? "default" : "pointer",
              fontWeight: 800,
            }}
          >
            {loading ? "Загрузка..." : "Обновить"}
          </button>

          <div style={{ opacity: 0.75 }}>
            В очереди: <b>{items.length}</b>
          </div>
        </div>

        {error ? (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              marginBottom: 12,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#7f1d1d",
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <div style={{ opacity: 0.8 }}>Загружаю очередь…</div>
        ) : items.length === 0 ? (
          <div style={{ opacity: 0.8 }}>Очередь пуста (или нет доступа).</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((it) => {
              const id = getId(it);
              const title = it?.title || it?.name || `Материал #${id}`;
              const author = it?.author_name || it?.author || it?.user_name || "";
              const status = it?.status || it?.state || "pending";

              const disabled = busyId === id;

              return (
                <div
                  key={String(id)}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "baseline",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
                    <div style={{ opacity: 0.65, fontSize: 13 }}>
                      #{id} · {status}
                      {author ? ` · ${author}` : ""}
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => onPublish(it)}
                      disabled={disabled}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.12)",
                        background: disabled ? "rgba(0,0,0,0.06)" : "#fff",
                        cursor: disabled ? "default" : "pointer",
                        fontWeight: 800,
                      }}
                    >
                      {disabled ? "..." : "Опубликовать"}
                    </button>

                    <button
                      onClick={() => onChanges(it)}
                      disabled={disabled}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.12)",
                        background: disabled ? "rgba(0,0,0,0.06)" : "#fff",
                        cursor: disabled ? "default" : "pointer",
                        fontWeight: 800,
                      }}
                    >
                      {disabled ? "..." : "Запросить правки"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
/* ---------------- IZOTOVLIFE EDITORIAL COMMENT ---------------- */

/**
 * Получить комментарий IzotovLife по slug новости
 */
export async function getEditorialComment(slug) {
  if (!slug) return null;
  try {
    const r = await api.get(`/editorial-comment/${encodeURIComponent(slug)}/`);
    return r?.data || null;
  } catch {
    return null;
  }
}

/**
 * Сохранить комментарий IzotovLife
 */
export async function saveEditorialComment(slug, content) {
  if (!slug) throw new Error("saveEditorialComment: нужен slug");

  const r = await api.post(`/editorial-comment/${encodeURIComponent(slug)}/`, {
    content,
  });

  return r?.data || r;
}
