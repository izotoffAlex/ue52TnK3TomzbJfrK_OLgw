/* Путь: frontend/src/pages/SmartSlugPage.js
   Назначение: Универсальный обработчик маршрута /:slug — решает, что показывать:
     - категорию (CategoryPage)
     - канал пользователя (UserChannelPage)
*/

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CategoryPage from "./CategoryPage";
import UserChannelPage from "./UserChannelPage";
import { tryGet } from "../Api";

function cacheKey(slug) {
  return `iz:resolve:${slug}`;
}

export default function SmartSlugPage() {
  const { slug } = useParams();
  const s = (slug || "").trim().toLowerCase();

  const [state, setState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(cacheKey(s));
      if (raw) return { loading: false, data: JSON.parse(raw), error: null };
    } catch {}
    return { loading: true, data: null, error: null };
  });

  useEffect(() => {
    let alive = true;
    if (!s) return;

    try {
      const raw = sessionStorage.getItem(cacheKey(s));
      if (raw) {
        const data = JSON.parse(raw);
        setState({ loading: false, data, error: null });
        return;
      }
    } catch {}

    (async () => {
      try {
        const resp = await tryGet(`/resolve/${encodeURIComponent(s)}/`);
        const data = resp?.data || resp;
        if (!alive) return;
        setState({ loading: false, data, error: null });
        try {
          sessionStorage.setItem(cacheKey(s), JSON.stringify(data));
        } catch {}
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, data: null, error: e });
      }
    })();

    return () => {
      alive = false;
    };
  }, [s]);

  const type = state.data?.type;

  if (state.loading) return <CategoryPage />;
  if (type === "channel") return <UserChannelPage />;
  return <CategoryPage />;
}
