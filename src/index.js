// Путь: frontend/src/index.js
// Назначение: Точка входа фронтенда, подключение App, HelmetProvider и BrowserRouter с future-флагами v7.
// Что внутри:
// - React 18 createRoot()
// - HelmetProvider для SEO-мета-тегов (обёрнут СНАРУЖИ роутера — стабильнее)
// - BrowserRouter с future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
// - Подключение глобальных стилей
//
// ВАЖНО: Если <BrowserRouter> уже есть внутри App.js — удалите его там, чтобы не было двойного роутера.
import "./Api";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// SEO: HelmetProvider
import { HelmetProvider } from "react-helmet-async";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
