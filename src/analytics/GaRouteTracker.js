// Путь: frontend/src/analytics/GaRouteTracker.js
// Назначение: Отслеживает смену маршрута в react-router-dom v6 и отправляет page_view в GA4.
// Фикс важный:
//   ✅ На первом маунте НЕ отправляем page_view, чтобы не удваивать первый просмотр
//      (первый просмотр обычно уже отправлен gtag('config', ...) в index.html).

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { gaPageView } from "./ga";

export default function GaRouteTracker() {
  const location = useLocation();
  const firstRef = useRef(true);

  useEffect(() => {
    const path = location.pathname + location.search;

    if (firstRef.current) {
      firstRef.current = false;
      return;
    }

    gaPageView(path);
  }, [location.pathname, location.search]);

  return null;
}
