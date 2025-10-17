// frontend/src/pages/NewPasswordPage.js
// Назначение: Форма для ввода нового пароля после перехода по ссылке из письма.
// Путь: frontend/src/pages/NewPasswordPage.js

import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { confirmPasswordReset } from "../Api";

export default function NewPasswordPage() {
  const { uid, token } = useParams(); // uidb64 и token приходят из URL
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await confirmPasswordReset(uid, token, { password });
      setMessage("Пароль успешно изменён! Сейчас вы будете перенаправлены на страницу входа.");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      console.error("Ошибка при сбросе пароля:", err);
      setError(err?.response?.data?.detail || "Не удалось изменить пароль.");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-[var(--bg-card)] p-6 rounded-xl shadow">
      <h1 className="text-xl font-bold mb-4 text-white">Новый пароль</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Введите новый пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 rounded border border-gray-600 bg-transparent text-white pr-20"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-2 px-2 py-1 bg-gray-700 text-xs rounded text-white"
          >
            {showPassword ? "Скрыть" : "Показать"}
          </button>
        </div>

        {error && <div className="text-red-400 text-sm">{error}</div>}
        {message && <div className="text-green-400 text-sm">{message}</div>}

        <button
          type="submit"
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-bold"
        >
          Сохранить новый пароль
        </button>
      </form>
    </div>
  );
}
