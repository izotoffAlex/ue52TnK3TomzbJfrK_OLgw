// Путь: frontend/src/components/SmartTitle.jsx
// Назначение: Красиво рендерит заголовок статьи. Если встречается " // " — выносит правую часть в подзаголовок.
// Совместимость: можно передать либо `text`, либо весь `item` (тогда возьмём getTitlePartsFromItem).
// Использование:
//   <SmartTitle text={item.title} as="h1" className={s.title} />
//   или
//   <SmartTitle item={item} as="h1" className={s.title} />

import React from "react";
import styles from "./SmartTitle.module.css";
import { getTitlePartsFromItem, splitTitleParts, parseSmartTitle } from "../utils/title";

export default function SmartTitle({
  item = null,
  text = "",
  as = "h1",
  className = "",
  showSubtitle = true,
}) {
  let main = "";
  let sub = "";

  if (item) {
    const parts = getTitlePartsFromItem(item);
    if (parts.length >= 2) {
      main = parts[0];
      sub = parts.slice(1).join(" — ");
    } else {
      ({ main, sub } = parseSmartTitle(parts[0] || ""));
    }
  } else {
    const parts = splitTitleParts(text);
    if (parts.length >= 2) {
      main = parts[0];
      sub = parts.slice(1).join(" — ");
    } else {
      ({ main, sub } = parseSmartTitle(parts[0] || ""));
    }
  }

  const Tag = as;

  return (
    <div className={`${styles.wrap} ${className || ""}`}>
      <Tag className={styles.main}>{main}</Tag>
      {showSubtitle && sub ? <div className={styles.sub}>{sub}</div> : null}
    </div>
  );
}
