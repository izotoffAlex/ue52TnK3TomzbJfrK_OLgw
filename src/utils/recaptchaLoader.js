// Путь: frontend/src/utils/recaptchaLoader.js
// Назначение: Лениво грузит reCAPTCHA v2, один раз на сессию, затем отдаёт grecaptcha.

let loadPromise = null;

export function loadRecaptcha(lang = "ru") {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const cbName = "__onRecaptchaLoaded__" + Math.random().toString(36).slice(2);
    window[cbName] = () => {
      try {
        if (window.grecaptcha?.render) resolve(window.grecaptcha);
        else reject(new Error("grecaptcha not available"));
      } catch (e) {
        reject(e);
      } finally {
        try { delete window[cbName]; } catch {}
      }
    };

    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?onload=${cbName}&render=explicit&hl=${encodeURIComponent(lang)}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load reCAPTCHA"));
    document.head.appendChild(s);
  });

  return loadPromise;
}
