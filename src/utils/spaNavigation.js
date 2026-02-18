// Путь: frontend/src/utils/spaNavigation.js
// Назначение: Универсальный детектор навигации SPA без зависимостей от react-router.
// Зачем:
//   - Иногда "белый экран" появляется из-за падения useLocation() (если компонент оказался вне Router).
//   - Этот механизм работает всегда: слушает window.history.pushState/replaceState и popstate.
// Что делает:
//   ✅ Генерирует событие window "izotovlife:navigate" при любом изменении URL в SPA
//   ✅ Ставит защиту от повторной установки (не патчит history дважды)
//   ✅ Совместимо с CRA ESLint (используем window.history, а не history)

export function installNavigationEvents() {
  if (typeof window === "undefined") return;
  if (window.__izotovlife_nav_installed) return;
  window.__izotovlife_nav_installed = true;

  const fire = () => {
    try {
      window.dispatchEvent(new Event("izotovlife:navigate"));
    } catch (e) {}
  };

  // back/forward
  window.addEventListener("popstate", fire);

  // Патчим pushState/replaceState
  const hist = window.history;
  if (!hist) return;

  const _pushState = hist.pushState;
  const _replaceState = hist.replaceState;

  hist.pushState = function (...args) {
    const ret = _pushState.apply(this, args);
    fire();
    return ret;
  };

  hist.replaceState = function (...args) {
    const ret = _replaceState.apply(this, args);
    fire();
    return ret;
  };
}
