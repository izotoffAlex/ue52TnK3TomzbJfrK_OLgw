// Путь: frontend/src/components/toast/ToastProvider.jsx
// Назначение: Глобальные тост-уведомления и API через window-событие 'toast:show'.
// Использование: оберни <App/> в <ToastProvider>. Показывать тост можно двумя способами:
//   1) из React-кода: const { showToast } = useToast(); showToast('...', 'info')
//   2) вне React: window.dispatchEvent(new CustomEvent('toast:show', { detail: { message, variant } }))
//
// Варианты variant: 'info' | 'success' | 'warning' | 'error'.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import styles from "./ToastProvider.module.css";

const ToastCtx = createContext({ showToast: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

let counter = 0;

export default function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const remove = useCallback((id) => {
    setItems((arr) => arr.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback((message, variant = "info", ttl = 3500) => {
    const id = ++counter;
    setItems((arr) => [...arr, { id, message, variant }]);
    if (ttl > 0) {
      setTimeout(() => remove(id), ttl + 200); // чуть больше, чтобы анимация успела
    }
  }, [remove]);

  // Подписка на глобальные события (вне React)
  useEffect(() => {
    function onShow(e) {
      try {
        const { message, variant, ttl } = e.detail || {};
        if (message) showToast(String(message), variant || "info", ttl ?? 3500);
      } catch {}
    }
    window.addEventListener("toast:show", onShow);
    return () => window.removeEventListener("toast:show", onShow);
  }, [showToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className={styles.wrap} aria-live="polite" aria-atomic="true">
        {items.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${styles["v_" + t.variant] || ""}`}
            onAnimationEnd={(e) => {
              if (e.animationName.includes("fadeOut")) remove(t.id);
            }}
            role="status"
          >
            <span className={styles.msg}>{t.message}</span>
            <button
              className={styles.close}
              onClick={() => remove(t.id)}
              aria-label="Закрыть"
              title="Закрыть"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
