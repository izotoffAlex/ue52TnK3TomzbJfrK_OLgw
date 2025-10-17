// frontend/src/index.js
// Назначение: Точка входа фронтенда, подключение App и HelmetProvider.
// Путь: frontend/src/index.js

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// SEO: HelmetProvider
import { HelmetProvider } from "react-helmet-async";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);


