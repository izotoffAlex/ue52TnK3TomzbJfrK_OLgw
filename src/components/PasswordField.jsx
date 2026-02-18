/* Путь: frontend/src/components/PasswordField.jsx
   Назначение: Поле пароля с кнопкой показать/скрыть + генератор пароля.
   Важно: стили через CSS-модуль и переменные темы (светлая/тёмная). */

import React, { useMemo, useState } from "react";
import styles from "./PasswordField.module.css";

function genPassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function PasswordField({
  value,
  onChange,
  placeholder = "Пароль",
  disabled = false,
  showGenerate = true,
}) {
  const [show, setShow] = useState(false);
  const type = useMemo(() => (show ? "text" : "password"), [show]);

  return (
    <div className={styles.row}>
      <div className={styles.inputWrap}>
        <input
          className={styles.input}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="new-password"
        />

        <button
          type="button"
          className={styles.eyeBtn}
          onClick={() => setShow((s) => !s)}
          title={show ? "Скрыть пароль" : "Показать пароль"}
          aria-label={show ? "Скрыть пароль" : "Показать пароль"}
        >
          {show ? "🙈" : "👁️"}
        </button>
      </div>

      {showGenerate ? (
        <button
          type="button"
          className={styles.genBtn}
          onClick={() => onChange(genPassword(12))}
          disabled={disabled}
          title="Сгенерировать пароль"
        >
          Сгенерировать
        </button>
      ) : null}
    </div>
  );
}

