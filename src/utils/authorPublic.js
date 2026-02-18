// Путь: frontend/src/utils/authorPublic.js
// Назначение: Нормализация данных автора для фронта (breadcrumbs, карточки, страницы автора).
// Почему нужно:
//   - разные API/модели могут отдавать автора в разных полях (author.username, author_username, author_login, author_name...)
//   - нам нужно стабильно получить:
//       1) authorUsername (для ссылки /author/<username>)
//       2) authorTitle (для текста "Александр Изотов")
//
// Ничего существующего не трогаем — это новый helper.

export function pickAuthorUsername(obj) {
  if (!obj) return "";

  // Вариант 1: вложенный объект author
  const a = obj.author || obj.user || obj.owner || obj.creator || null;
  if (a) {
    const u =
      (a.username || a.login || a.slug || a.user_name || a.user || "").toString().trim();
    if (u) return u;
  }

  // Вариант 2: плоские поля
  const flat =
    (obj.author_username ||
      obj.author_login ||
      obj.author_slug ||
      obj.username ||
      obj.user_username ||
      obj.user_login ||
      obj.user_slug ||
      obj.owner_username ||
      obj.creator_username ||
      "").toString().trim();

  return flat;
}

export function pickAuthorTitle(obj) {
  if (!obj) return "";

  const a = obj.author || obj.user || obj.owner || obj.creator || null;
  if (a) {
    const fn = (a.first_name || "").toString().trim();
    const ln = (a.last_name || "").toString().trim();
    const full = [fn, ln].filter(Boolean).join(" ").trim();
    if (full) return full;

    const dn = (a.display_name || a.name || a.title || "").toString().trim();
    if (dn) return dn;

    const u = (a.username || a.login || a.slug || "").toString().trim();
    if (u) return u;
  }

  // Плоские поля
  const flat =
    (obj.author_name ||
      obj.author_full_name ||
      obj.author_display_name ||
      obj.author_title ||
      obj.author ||
      "").toString().trim();

  if (flat) return flat;

  // Фолбэк — хотя бы username
  return pickAuthorUsername(obj);
}

export function pickAuthorForBreadcrumbs(obj) {
  const username = pickAuthorUsername(obj);
  const title = pickAuthorTitle(obj);
  if (!username && !title) return null;

  return {
    username: username || "", // для ссылки /author/<username>
    title: title || username || "Автор",
  };
}
