// frontend/src/components/CardBase.js
// Назначение: Базовый контейнер для карточек новостей (с картинкой и без).
// Путь: frontend/src/components/CardBase.js

import React from "react";

export default function CardBase({ children, height }) {
  return (
    <div
      className={`bg-[#111827] border border-gray-800 rounded-xl shadow-md overflow-hidden ${height}`}
    >
      {children}
    </div>
  );
}

