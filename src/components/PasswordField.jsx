// Путь: frontend/src/components/PasswordField.jsx
// Назначение: Поле ввода пароля с кнопками «показать/скрыть» и «сгенерировать».
// Обновления:
//   ✅ Кнопка-глаз корректно размещена внутри поля (правый край, по центру).
//   ✅ Поддержка props: required, minLength (по умолчанию 8), onBlur.
//   ✅ Внешний API НЕ изменён (value/onChange как раньше).

import React, { useState } from "react";

export default function PasswordField({
  value,
  onChange,
  placeholder = "Пароль",
  id = "password",
  name = "password",
  required = true,
  minLength = 8,
  onBlur,
}) {
  const [show, setShow] = useState(false);

  function generatePassword() {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const symbols = "!@#$%^&*-_=+?";
    const all = upper + lower + digits + symbols;
    const pick = (str) => str[Math.floor(Math.random() * str.length)];

    const must = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    let rest = "";
    for (let i = 0; i < Math.max(10, minLength - must.length); i++) rest += pick(all);

    const arr = (must.join("") + rest).split("");
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const pwd = arr.join("");
    onChange({ target: { name, value: pwd } });
  }

  const HEIGHT = 44;
  const RADIUS = 12;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        columnGap: 8,
        alignItems: "stretch",
        width: "100%",
      }}
    >
      {/* Поле пароля + иконка */}
      <div style={{ position: "relative", width: "100%" }}>
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete="new-password"
          required={required}
          minLength={minLength}
          style={{
            width: "100%",
            height: HEIGHT,
            padding: `0 ${HEIGHT}px 0 12px`,
            borderRadius: RADIUS,
            border: "1px solid #2b3551",
            background: "#0a0f1a",
            color: "#e6eefc",
            outline: "none",
          }}
        />

        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          title={show ? "Скрыть пароль" : "Показать пароль"}
          style={{
            position: "absolute",
            top: "50%",
            right: 8,
            transform: "translateY(-50%)",
            width: HEIGHT - 8,
            height: HEIGHT - 8,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            border: "1px solid #2b3551",
            background: "#0f1629",
            color: "#e6eefc",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {show ? "👁‍🗨" : "👁"}
        </button>
      </div>

      {/* Кнопка генерации */}
      <button
        type="button"
        onClick={generatePassword}
        title="Сгенерировать пароль"
        style={{
          height: HEIGHT,
          padding: "0 12px",
          borderRadius: RADIUS - 4,
          border: "1px solid #2b3551",
          background: "#0f1629",
          color: "#e6eefc",
          cursor: "pointer",
          whiteSpace: "nowrap",
          fontWeight: 600,
        }}
      >
        Сгенерировать
      </button>
    </div>
  );
}
