// Путь: frontend/src/pages/SuggestPage.js
// Назначение: страница для формы "Предложить новость"

import React from "react";
import SuggestNewsForm from "../components/forms/SuggestNewsForm";

export default function SuggestPage() {
  return (
    <main style={{ padding: "20px" }}>
      <SuggestNewsForm />
    </main>
  );
}
