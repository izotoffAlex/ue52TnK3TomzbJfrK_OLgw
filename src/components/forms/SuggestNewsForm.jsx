// Путь: frontend/src/components/forms/SuggestNewsForm.jsx
// Назначение: форма "Предложить новость" с обработкой ошибок и отправкой на API IzotovLife.

import React, { useState } from "react";
import { suggestNews } from "../../Api";

export default function SuggestNewsForm() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    message: "",
    website: "",
  });

  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      await suggestNews(form);
      setStatus("success");
      setForm({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        message: "",
        website: "",
      });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Ошибка при отправке");
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
      <h2>Предложить новость</h2>
      <form onSubmit={handleSubmit}>
        <input
          name="first_name"
          placeholder="Имя"
          value={form.first_name}
          onChange={handleChange}
          required
          style={{ display: "block", width: "100%", marginBottom: 10 }}
        />
        <input
          name="last_name"
          placeholder="Фамилия"
          value={form.last_name}
          onChange={handleChange}
          style={{ display: "block", width: "100%", marginBottom: 10 }}
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
          style={{ display: "block", width: "100%", marginBottom: 10 }}
        />
        <input
          name="phone"
          placeholder="Телефон"
          value={form.phone}
          onChange={handleChange}
          style={{ display: "block", width: "100%", marginBottom: 10 }}
        />
        <textarea
          name="message"
          placeholder="Описание новости"
          value={form.message}
          onChange={handleChange}
          required
          style={{
            display: "block",
            width: "100%",
            height: 120,
            marginBottom: 10,
            resize: "vertical",
          }}
        />
        <input
          name="website"
          placeholder="Ссылка на источник (если есть)"
          value={form.website}
          onChange={handleChange}
          style={{ display: "block", width: "100%", marginBottom: 10 }}
        />

        <button
          type="submit"
          disabled={status === "loading"}
          style={{
            backgroundColor: "#007bff",
            color: "white",
            padding: "10px 20px",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {status === "loading" ? "Отправка..." : "Отправить"}
        </button>
      </form>

      {status === "success" && (
        <p style={{ color: "green", marginTop: 10 }}>
          ✅ Ваша новость успешно отправлена!
        </p>
      )}

      {status === "error" && (
        <p style={{ color: "red", marginTop: 10 }}>⚠️ {errorMsg}</p>
      )}
    </div>
  );
}
