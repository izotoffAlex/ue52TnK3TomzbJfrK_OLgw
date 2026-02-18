// Путь: frontend/src/boot/favorite-click-guard.js
// Назначение: Перехват кликов на элементы с data-fav-slug, чтобы без входа не дергать сеть и
//             показывать мягкое уведомление. Работает даже без FavoriteButton.

import { hasAuth } from "../Api";

(function installFavGuard() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // Инжект небольшой CSS-анимации для произвольных элементов
  const css = `
  .il-heart-attn { animation: ilFavPulse .9s ease; box-shadow: 0 0 0 0 rgba(249,200,92,.6) !important; }
  @keyframes ilFavPulse {
    0% { box-shadow: 0 0 0 0 rgba(249,200,92,.6); }
    70% { box-shadow: 0 0 0 10px rgba(249,200,92,0); }
    100% { box-shadow: 0 0 0 0 rgba(249,200,92,0); }
  }`;
  const style = document.createElement("style");
  style.dataset.il = "fav-guard";
  style.textContent = css;
  document.head.appendChild(style);

  function closestWithAttr(el, attr) {
    while (el && el !== document.body) {
      if (el.hasAttribute && el.hasAttribute(attr)) return el;
      el = el.parentElement;
    }
    return null;
  }

  document.addEventListener("click", (e) => {
    const target = e.target;
    const btn = closestWithAttr(target, "data-fav-slug");
    if (!btn) return;
    if (hasAuth()) return; // всё ок, пользователь вошел

    e.preventDefault();
    e.stopPropagation();

    btn.classList.add("il-heart-attn");
    setTimeout(() => btn.classList.remove("il-heart-attn"), 900);

    window.dispatchEvent(
      new CustomEvent("toast:show", {
        detail: { message: "Войдите, чтобы добавлять в избранное.", variant: "info" },
      })
    );
  }, true);
})();
