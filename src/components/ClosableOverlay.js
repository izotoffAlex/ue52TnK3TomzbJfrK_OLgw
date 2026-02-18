// Путь: frontend/src/components/ClosableOverlay.js
// Назначение: Универсальный оверлей/попап, который можно закрыть:
//   ✅ по кнопке "✕"
//   ✅ по клику по фону (backdrop)
//   ✅ по клавише ESC (на ПК)
// Использование: оборачиваем любое всплывающее окно (например подсказки поиска).

import React, { useEffect } from "react";
import styles from "./ClosableOverlay.module.css";

export default function ClosableOverlay({
  open,
  onClose,
  title = "",
  children,
  closeOnBackdrop = true,
  closeOnEsc = true,
  zIndex = 9999,
  topOffset = null, // можно передать число (px), если нужно опустить попап ниже шапки
}) {
  useEffect(() => {
    if (!open) return;

    if (!closeOnEsc) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeOnEsc, onClose]);

  if (!open) return null;

  const overlayStyle = { zIndex };
  const panelStyle = {};
  if (typeof topOffset === "number") {
    panelStyle.marginTop = `${Math.max(0, topOffset)}px`;
  }

  const handleBackdropClick = () => {
    if (!closeOnBackdrop) return;
    onClose?.();
  };

  const stop = (e) => e.stopPropagation();

  return (
    <div className={styles.overlay} style={overlayStyle} onClick={handleBackdropClick}>
      <div className={styles.panel} style={panelStyle} onClick={stop} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div className={styles.title} title={title}>
            {title}
          </div>

          <button className={styles.closeBtn} type="button" aria-label="Закрыть" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
