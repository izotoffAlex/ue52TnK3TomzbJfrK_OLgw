// frontend/src/utils/getImageUrl.js
// Назначение: Возвращает корректный путь к изображению или заглушке.
// Путь: frontend/src/utils/getImageUrl.js

const API_URL = "http://127.0.0.1:8000"; // Django сервер (dev)

export function getImageUrl(url) {
  const fallback = `${API_URL}/static/img/default_news.svg`;

  // Если картинки нет → заглушка
  if (!url) return fallback;

  // Если уже абсолютный URL (http/https) → оставляем как есть
  if (url.startsWith("http")) return url;

  // Иначе склеиваем с API_URL
  return `${API_URL}${url}`;
}
