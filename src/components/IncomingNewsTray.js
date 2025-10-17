// Путь: frontend/src/components/IncomingNewsTray.js
// Назначение: Плавающее окно входящих новостей.
// Особенности:
//   ✅ Автоматически высчитывает высоту под 1/2/3 карточки.
//   ✅ Без CLSX, только CSS-модуль.
//   ✅ Заголовок теперь необязательный (по умолчанию скрыт).

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import s from "./IncomingNewsTray.module.css";

export default function IncomingNewsTray({
  items = [],
  renderItem,
  maxRows = 3,
  gap = 8,
  className = "",
  title = "", // ← теперь по умолчанию пусто
}) {
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const [height, setHeight] = useState(0);

  const rows = useMemo(() => Math.min(items.length, Math.max(1, maxRows)), [items.length, maxRows]);
  const visible = useMemo(() => items.slice(0, rows), [items, rows]);

  const measure = () => {
    const list = listRef.current;
    if (!list) return;
    const children = Array.from(list.children || []).slice(0, rows);
    let total = 0;
    for (const el of children) {
      const rect = el.getBoundingClientRect();
      total += rect.height;
    }
    const computedGap =
      Number(getComputedStyle(list).getPropertyValue("--tray-gap").replace("px", "")) || gap;
    total += Math.max(0, rows - 1) * computedGap;
    setHeight(Math.ceil(total));
  };

  useLayoutEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, visible.map((v) => v?.id || v?.slug || v?.title).join("|")]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(wrapRef.current);
    if (listRef.current) ro.observe(listRef.current);
    const children = Array.from(listRef.current?.children || []);
    children.slice(0, rows).forEach((el) => ro.observe(el));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, visible.length]);

  return (
    <div
      ref={wrapRef}
      className={`${s.trayWrap} ${className || ""}`}
      style={{ "--tray-gap": `${gap}px` }}
    >
      {/* Заголовок теперь отображается только если явно передан */}
      {title && (
        <div className={s.header}>
          <span className={s.title}>{title}</span>
          {items.length > rows && <span className={s.counter}>+{items.length - rows}</span>}
        </div>
      )}

      <div className={s.listWrap} style={{ height }}>
        <div ref={listRef} className={s.list}>
          {visible.map((n, idx) => (
            <div key={n.id ?? n.slug ?? idx} className={s.item}>
              {typeof renderItem === "function" ? renderItem(n) : <DefaultItem item={n} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DefaultItem({ item }) {
  return (
    <div className={s.card}>
      <div className={s.cardTitle}>{item.title}</div>
      {item.source && <div className={s.cardMeta}>{item.source}</div>}
    </div>
  );
}
