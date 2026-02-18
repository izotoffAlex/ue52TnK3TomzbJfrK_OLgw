// Путь: frontend/src/pages/SuggestPage.js
// Назначение: страница для формы "Предложить новость"
// Примечание: файл оставлен без изменений (в нём нет капчи, это просто обёртка страницы).

import React from "react";
import { Helmet } from "react-helmet-async";
import SuggestNewsForm from "../components/forms/SuggestNewsForm";
import s from "./SuggestPage.module.css";

export default function SuggestPage() {
  return (
    <>
      <Helmet>
        <title>Предложить новость — IzotovLife</title>
        <meta
          name="description"
          content="Форма для отправки новости редакции IzotovLife. Вы можете поделиться важной информацией или интересной историей."
        />
      </Helmet>

      <main className={s.page}>
        <div className={s.wrap}>
          <div className={s.card}>
            <SuggestNewsForm />
          </div>
        </div>
      </main>
    </>
  );
}

