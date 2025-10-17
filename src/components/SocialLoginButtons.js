// frontend/src/components/SocialLoginButtons.js
// Назначение: Кнопки входа через соцсети (VK, Yandex, Google), редиректят на backend (django-allauth).
// Путь: frontend/src/components/SocialLoginButtons.js

import React from "react";

export default function SocialLoginButtons() {
  // базовый URL бэкенда
  const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";

  return (
    <div className="social-login">
      <h3>Войти через социальные сети</h3>
      <div className="buttons">
        <a
          className="btn btn-vk"
          href={`${backendUrl}/accounts/vk/login/`}
        >
          Войти через VK
        </a>

        <a
          className="btn btn-yandex"
          href={`${backendUrl}/accounts/yandex/login/`}
        >
          Войти через Яндекс
        </a>

        <a
          className="btn btn-google"
          href={`${backendUrl}/accounts/google/login/`}
        >
          Войти через Google
        </a>
      </div>

      {/* немного базовых стилей */}
      <style jsx>{`
        .social-login {
          margin-top: 20px;
        }
        .buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        a.btn {
          display: inline-block;
          padding: 10px 15px;
          border-radius: 6px;
          color: white;
          font-weight: bold;
          text-decoration: none;
          transition: opacity 0.2s;
        }
        .btn:hover {
          opacity: 0.85;
        }
        .btn-vk {
          background-color: #4a76a8;
        }
        .btn-yandex {
          background-color: #ffcc00;
          color: black;
        }
        .btn-google {
          background-color: #db4437;
        }
      `}</style>
    </div>
  );
}
