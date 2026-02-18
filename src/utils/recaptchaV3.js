// Путь: frontend/src/utils/recaptchaV3.js
// Назначение: Загрузка Google reCAPTCHA v3 и получение токена по action перед отправкой формы.

let _loadPromise = null;

function loadScriptOnce(siteKey) {
  if (_loadPromise) return _loadPromise;

  _loadPromise = new Promise((resolve, reject) => {
    if (!siteKey) {
      reject(new Error("REACT_APP_RECAPTCHA_V3_SITE_KEY пустой (не задан в env)."));
      return;
    }

    if (window.grecaptcha && typeof window.grecaptcha.ready === "function") {
      resolve(true);
      return;
    }

    const existing = document.querySelector('script[data-izotovlife="recaptcha-v3"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => reject(new Error("Не удалось загрузить reCAPTCHA v3.")));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-izotovlife", "recaptcha-v3");
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Не удалось загрузить reCAPTCHA v3."));
    document.head.appendChild(script);
  });

  return _loadPromise;
}

export async function getRecaptchaV3Token(action) {
  const siteKey = process.env.REACT_APP_RECAPTCHA_V3_SITE_KEY;

  await loadScriptOnce(siteKey);

  const token = await new Promise((resolve, reject) => {
    window.grecaptcha.ready(() => {
      window.grecaptcha.execute(siteKey, { action }).then(resolve).catch(reject);
    });
  });

  if (!token) throw new Error("reCAPTCHA вернула пустой токен.");
  return token;
}
