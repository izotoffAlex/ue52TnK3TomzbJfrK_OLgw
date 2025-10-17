// Путь: frontend/src/pages/RegisterPage.js
// Назначение: Форма регистрации: имя, фамилия, e-mail, пароль.
// Функции:
//   - Показать/скрыть пароль
//   - Генерация пароля
//   - После успешной отправки показывает "проверьте свою электронную почту"
// Ничего существующее не удаляет — это новый файл.

import React, { useState } from "react";
import PasswordField from "../components/PasswordField";
import { register } from "../api/auth";
import { Link } from "react-router-dom";

export default function RegisterPage() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");

  function onChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form);
      setOk(true); // покажем уведомление
    } catch (err) {
      setError(err.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  }

  if (ok) {
    return (
      <div style={{ maxWidth: 520, margin: "40px auto", color: "#e6eefc" }}>
        <div style={{ background: "#111a2b", padding: 24, borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,.35)" }}>
          <h1 style={{ marginTop: 0 }}>Проверьте свою электронную почту ✉️</h1>
          <p>Мы отправили письмо со ссылкой для подтверждения регистрации. Перейдите по ней, чтобы активировать аккаунт.</p>
          <p style={{ opacity: .8, fontSize: 14 }}>
            Уже подтвердили? <Link to="/login" style={{ color: "#93c5fd" }}>Войти</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", color: "#e6eefc" }}>
      <form onSubmit={onSubmit} style={{ background: "#111a2b", padding: 24, borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,.35)" }}>
        <h1 style={{ marginTop: 0 }}>Регистрация</h1>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label htmlFor="first_name" style={{ display: "block", marginBottom: 6 }}>Имя</label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              value={form.first_name}
              onChange={onChange}
              placeholder="Иван"
              required
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #2b3551", background: "#0a0f1a", color: "#e6eefc" }}
            />
          </div>

          <div>
            <label htmlFor="last_name" style={{ display: "block", marginBottom: 6 }}>Фамилия</label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              value={form.last_name}
              onChange={onChange}
              placeholder="Иванов"
              required
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #2b3551", background: "#0a0f1a", color: "#e6eefc" }}
            />
          </div>

          <div>
            <label htmlFor="email" style={{ display: "block", marginBottom: 6 }}>E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="you@example.com"
              required
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #2b3551", background: "#0a0f1a", color: "#e6eefc" }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: "block", marginBottom: 6 }}>Пароль</label>
            <PasswordField value={form.password} onChange={onChange} />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: 12, background: "#2a0f12", borderRadius: 12, color: "#ffd2d2" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #2b3551",
            background: loading ? "#0d1530" : "#1d4ed8",
            color: "#fff",
            cursor: loading ? "default" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Отправка..." : "Регистрация"}
        </button>

        <p style={{ marginTop: 12, opacity: .8, fontSize: 14 }}>
          Уже есть аккаунт? <Link to="/login" style={{ color: "#93c5fd" }}>Войти</Link>
        </p>
      </form>
    </div>
  );
}
