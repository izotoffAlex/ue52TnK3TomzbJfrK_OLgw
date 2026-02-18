// Путь: frontend/src/components/zen/ZenPortal.jsx
// Портал: контейнер сразу фиксится поверх всего документа.

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function ZenPortal({ children, mountId = "zen-portal-root" }) {
  const elRef = useRef(null);

  if (!elRef.current) {
    const el = document.createElement("div");
    el.id = mountId;

    // критично: сам портал фиксируем поверх всего
    el.style.position = "fixed";
    el.style.inset = "0";
    el.style.zIndex = "2147483647"; // максимум
    el.style.pointerEvents = "none"; // события поймает вложенный слой
    elRef.current = el;
  }

  useEffect(() => {
    document.body.appendChild(elRef.current);
    return () => {
      try {
        document.body.removeChild(elRef.current);
      } catch {}
    };
  }, []);

  // внутри портала вернём нормальные события
  return createPortal(
    <div style={{ pointerEvents: "auto", width: "100%", height: "100%" }}>
      {children}
    </div>,
    elRef.current
  );
}
