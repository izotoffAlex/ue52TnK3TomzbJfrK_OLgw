// frontend/src/pages/ResetPasswordPage.js
// Назначение: Форма для запроса восстановления пароля.
// Пользователь вводит email, и на него отправляется ссылка для сброса.
// Путь: frontend/src/pages/ResetPasswordPage.js

import React, { useState } from "react";
import { requestPasswordReset } from "../Api";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await requestPasswordReset({ email });
      setMessage("Если такой email зарегистрирован, на него отправлено письмо со ссылкой для сброса пароля.");
    } catch (err) {
      console.error("Ошибка сброса пароля:", err);
      setError(err?.response?.data?.detail || "Ошибка при отправке письма.");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-[var(--bg-card)] p-6 rounded-xl shadow">
      <h1 className="text-xl font-bold mb-4 text-white">Восстановление пароля</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Ваш email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 rounded border border-gray-600 bg-transparent text-white"
          required
        />

        {error && <div className="text-red-400 text-sm">{error}</div>}
        {message && <div className="text-green-400 text-sm">{message}</div>}

        <button
          type="submit"
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-bold"
        >
          Отправить письмо
        </button>
      </form>
    </div>
  );
}
