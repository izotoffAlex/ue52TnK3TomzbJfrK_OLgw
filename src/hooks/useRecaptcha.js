// Путь: frontend/src/hooks/useRecaptcha.js
// Назначение: Лениво загружает скрипт reCAPTCHA v3 и выдаёт токен execute(action).
// Особенности/обновления:
//   ✅ Параметр { enabled } — скрипт грузится ТОЛЬКО когда enabled=true (например, open модалки).
//   ✅ Параметр { locale } — прокидывается в hl=… (по умолчанию "ru").
//   ✅ Без ключа — ничего не делает (ready=false), но не ломает форму.
//   ✅ Надёжно «дожидается» window.grecaptcha.execute даже если <script> уже в DOM и onload был раньше.
//   ✅ Исключает повторные загрузки (одна промис-«загрузка» на ключ).
//
// Использование в компоненте:
//   const { ready, execute } = useRecaptcha(SITE_KEY, { enabled: open, locale: "ru" });
//   const token = await execute("suggest_news");

import { useEffect, useRef, useState } from "react";

const RECAPTCHA_BASE = "https://www.google.com/recaptcha/api.js";

// Глобальное состояние загрузки (по siteKey)
const loaderState = {
  siteKey: null,
  promise: null,
};

function waitForGrecaptchaReady(checkIntervalMs = 50, maxWaitMs = 15000) {
  // Ждём появления grecaptcha.execute
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function tick() {
      if (window.grecaptcha && typeof window.grecaptcha.execute === "function") {
        resolve(window.grecaptcha);
        return;
      }
      if (Date.now() - start > maxWaitMs) {
        reject(new Error("reCAPTCHA not ready in time"));
        return;
      }
      setTimeout(tick, checkIntervalMs);
    })();
  });
}

function injectScript(siteKey, locale = "ru") {
  if (!siteKey) {
    // Нет ключа — ничего не грузим, просто возвращаем неразрешённый grecaptcha
    return Promise.reject(new Error("Missing reCAPTCHA site key"));
  }
  if (loaderState.promise && loaderState.siteKey === siteKey) {
    return loaderState.promise;
  }

  loaderState.siteKey = siteKey;
  loaderState.promise = new Promise((resolve, reject) => {
    // Если grecaptcha уже есть — сразу ждём готовность
    if (window.grecaptcha && typeof window.grecaptcha.execute === "function") {
      waitForGrecaptchaReady().then(resolve).catch(reject);
      return;
    }

    // Ищем уже вставленный <script> (вдруг добавляли раньше)
    const exist = document.querySelector(`script[src*="recaptcha/api.js"]`);
    if (exist) {
      // Скрипт уже есть, просто дожидаемся готовности API
      waitForGrecaptchaReady().then(resolve).catch(reject);
      return;
    }

    // Вставляем новый <script>
    const s = document.createElement("script");
    const params = new URLSearchParams({
      render: siteKey,
      hl: locale || "ru",
    });
    s.src = `${RECAPTCHA_BASE}?${params.toString()}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load reCAPTCHA v3 script"));
    s.onload = () => {
      // Скрипт загружен, ждём, когда grecaptcha станет готов
      waitForGrecaptchaReady().then(resolve).catch(reject);
    };
    document.head.appendChild(s);
  });

  return loaderState.promise;
}

export default function useRecaptcha(siteKey, { enabled = true, locale = "ru" } = {}) {
  const [ready, setReady] = useState(false);
  const activeRef = useRef(false);
  const keyRef = useRef(siteKey);
  const locRef = useRef(locale);

  useEffect(() => {
    keyRef.current = siteKey;
  }, [siteKey]);
  useEffect(() => {
    locRef.current = locale;
  }, [locale]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!enabled) {
        setReady(false);
        return;
      }
      if (!siteKey) {
        setReady(false);
        return;
      }
      // Защита от повторных стартов
      if (activeRef.current) return;
      activeRef.current = true;

      try {
        await injectScript(siteKey, locale);
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setReady(false);
      } finally {
        activeRef.current = false;
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [enabled, siteKey, locale]);

  async function execute(action = "suggest_news") {
    if (!enabled) throw new Error("reCAPTCHA is disabled");
    if (!siteKey) throw new Error("Missing reCAPTCHA site key");
    // Убедимся, что API реально готов
    if (!(window.grecaptcha && typeof window.grecaptcha.execute === "function")) {
      throw new Error("Капча инициализируется, попробуйте через секунду.");
    }
    return await window.grecaptcha.execute(siteKey, { action });
  }

  return { ready, execute };
}
