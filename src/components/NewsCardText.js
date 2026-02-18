// frontend/src/components/NewsCardText.js
// Назначение: Текстовая карточка новости (для статей и RSS),
// визуально и по размерам согласована с NewsCardImage/NewsCard.

import React from "react";
import { Link } from "react-router-dom";
import s from "./NewsCardText.module.css";

export default function NewsCardText({ item }) {
  const title = item?.title || "Без названия";
  const description = item?.description || "";
  const preview = description ? description.slice(0, 150) + "…" : "";

  let detailTo = "#";
  if (item.type === "article" && item.slug) {
    detailTo = `/article/${item.slug}`;
  } else if (item.type === "rss" && item.id) {
    detailTo = `/rss/${item.id}`;
  }
  const hasLink = detailTo !== "#";

  return (
    <article className={s.card}>
      <h3 className={s.title}>
        {hasLink ? (
          <Link to={detailTo} className={s.titleLink}>
            {title}
          </Link>
        ) : (
          <span>{title}</span>
        )}
      </h3>

      {preview && <p className={s.preview}>{preview}</p>}
    </article>
  );
}
