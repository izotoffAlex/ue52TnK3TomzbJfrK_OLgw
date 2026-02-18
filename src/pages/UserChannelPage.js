/* Путь: frontend/src/pages/UserChannelPage.js
   Назначение: Публичная страница канала пользователя: https://izotovlife.ru/<channel_slug>/
   Данные берём из /api/channels/<slug>/.
*/

import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { tryGet } from "../Api";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

export default function UserChannelPage() {
  const { slug } = useParams();
  const s = (slug || "").trim().toLowerCase();

  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await tryGet(`/channels/${encodeURIComponent(s)}/`);
        const data = resp?.data || resp;
        if (!alive) return;
        setState({ loading: false, data, error: null });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, data: null, error: e });
      }
    })();
    return () => {
      alive = false;
    };
  }, [s]);

  const title =
    state.data?.channel_title ||
    state.data?.username ||
    "Канал пользователя";

  const desc = state.data?.bio
    ? String(state.data.bio).slice(0, 160)
    : "Публичная страница автора на IzotovLife.";

  return (
    <>
      <Helmet>
        <title>{title} — IzotovLife</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={`https://izotovlife.ru/${encodeURIComponent(s)}/`} />
      </Helmet>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "16px" }}>
        {state.loading && <div>Загружаем…</div>}
        {!state.loading && !state.data && <div>Канал не найден.</div>}

        {state.data && (
          <>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              {state.data.photo ? (
                <img
                  src={state.data.photo}
                  alt=""
                  style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover" }}
                />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: 16, background: "rgba(0,0,0,.08)" }} />
              )}

              <div>
                <h1 style={{ margin: 0 }}>{title}</h1>
                {state.data.username && <div style={{ opacity: 0.75 }}>@{state.data.username}</div>}
              </div>
            </div>

            {state.data.bio && <p style={{ marginTop: 12, opacity: 0.9 }}>{state.data.bio}</p>}

            <h2 style={{ marginTop: 24 }}>Публикации</h2>
            {(state.data.articles || []).length === 0 && (
              <div style={{ opacity: 0.7 }}>Пока нет опубликованных статей.</div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {(state.data.articles || []).map((a) => (
                <Link
                  key={a.id || a.slug}
                  to={a.slug ? `/news/${a.slug}/` : "#"}
                  style={{
                    textDecoration: "none",
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,.12)",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{a.title || "Без заголовка"}</div>
                  {a.published_at && (
                    <div style={{ opacity: 0.7, marginTop: 6 }}>{formatDate(a.published_at)}</div>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
