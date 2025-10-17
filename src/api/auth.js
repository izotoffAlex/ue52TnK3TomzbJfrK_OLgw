// Путь: frontend/src/api/auth.js
// Назначение: Мини-обёртка для регистрации пользователя через наш кастомный эндпоинт.
// Обновление: используем /api/auth/register/ (а НЕ /api/auth/registration/).
// Ничего лишнего не удалено — просто исправлен URL и улучшена обработка ошибок.

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

/**
 * Регистрация пользователя.
 * Ожидает payload вида:
 * { first_name: string, last_name: string, email: string, password: string }
 */
export async function register(payload) {
  const res = await fetch(`${API_BASE}/api/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Пытаемся прочитать тело как JSON, но безопасно
  let data = null;
  const txt = await res.text().catch(() => "");
  try { data = txt ? JSON.parse(txt) : null; } catch { data = null; }

  if (!res.ok) {
    // нормализуем сообщение об ошибке
    const firstFieldErr =
      (data && (data.email?.[0] || data.username?.[0] || data.password?.[0] ||
                data.first_name?.[0] || data.last_name?.[0])) ||
      (data && data.detail) ||
      "Ошибка регистрации (проверьте корректность полей).";
    throw new Error(firstFieldErr);
  }

  return data || { detail: "OK" };
}
