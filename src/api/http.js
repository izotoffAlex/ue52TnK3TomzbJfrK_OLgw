/* Путь: frontend/src/api/http.js
   Назначение: единая HTTP-обёртка для API IzotovLife.
   Делает:
     - baseURL = "/"
     - автоматически добавляет Authorization: Bearer <token> если токен сохранён
     - возвращает понятные ошибки
*/

import axios from "axios";
import { getAccessToken } from "../auth/tokenStorage";

export const api = axios.create({
  baseURL: "/",
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Автодобавление Bearer токена
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Нормализация ошибок (чтобы на UI можно было показать текст)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const message =
      (typeof data === "string" && data) ||
      data?.detail ||
      data?.message ||
      error?.message ||
      "Ошибка запроса";

    return Promise.reject({ status, data, message, raw: error });
  }
);
