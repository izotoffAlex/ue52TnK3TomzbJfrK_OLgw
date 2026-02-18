// Путь: frontend/src/components/CurrencyWidget.js
// Назначение: компактный виджет курсов валют в шапке IzotovLife.
// Поведение:
//   • При монтировании делает запрос на /api/currency/ (или другой ваш эндпоинт).
//   • Пытается «угадать» формат ответа (массив, объект с rates и т.п.).
//   • Показывает несколько основных валют в одну строку.
//   • При ошибке или отсутствии данных не ломает шапку, а выводит «Курсы: —».

import React, { useEffect, useState } from "react";

function normalizeRates(raw) {
  // Нормализуем данные в вид: [{ code: "USD", value: 90.12 }, ...]
  let items = [];

  if (!raw) return [];

  // Если пришёл массив
  if (Array.isArray(raw)) {
    items = raw.map((item) => {
      // Попробуем вытащить код валюты и значение из разных популярных форматов
      const code =
        item.code ||
        item.ccy ||
        item.CharCode ||
        item.currency ||
        item.name ||
        item[0];

      const value =
        item.value ||
        item.rate ||
        item.Rate ||
        item.sale ||
        item.buy ||
        item[1];

      return {
        code: String(code || "").toUpperCase(),
        value: typeof value === "number" ? value : Number(value),
      };
    });
  } else if (typeof raw === "object") {
    // Если пришёл объект с полем rates
    if (Array.isArray(raw.rates)) {
      items = normalizeRates(raw.rates);
    } else if (raw.rates && typeof raw.rates === "object") {
      items = Object.entries(raw.rates).map(([code, value]) => ({
        code: String(code || "").toUpperCase(),
        value: typeof value === "number" ? value : Number(value),
      }));
    } else {
      // Возможно, сам объект — словарь { "USD": 90.1, "EUR": 98.2 }
      items = Object.entries(raw).map(([code, value]) => ({
        code: String(code || "").toUpperCase(),
        value: typeof value === "number" ? value : Number(value),
      }));
    }
  }

  // Отфильтруем мусор
  items = items.filter(
    (item) =>
      item.code &&
      Number.isFinite(item.value) &&
      !Number.isNaN(item.value)
  );

  // Оставим только несколько популярных валют (если в ответе много)
  const preferredOrder = ["USD", "EUR", "GBP"];
  const byCode = Object.fromEntries(items.map((i) => [i.code, i]));

  const ordered = preferredOrder
    .map((code) => byCode[code])
    .filter(Boolean);

  const others = items.filter(
    (item) => !preferredOrder.includes(item.code)
  );

  return [...ordered, ...others].slice(0, 4); // максимум 4 шт.
}

const CurrencyWidget = () => {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadRates() {
      try {
        // 🔧 ЕСЛИ у тебя другой эндпоинт (например /api/rates/),
        // тут достаточно поменять строку на нужный URL.
        const response = await fetch("/api/currency/");

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (isCancelled) return;

        const normalized = normalizeRates(data);

        if (!normalized.length) {
          // Нет нормальных данных — не считаем это фатальной ошибкой
          setRates([]);
          setError(false);
        } else {
          setRates(normalized);
          setError(false);
        }
      } catch (e) {
        if (!isCancelled) {
          console.error("Ошибка загрузки курсов валют:", e);
          setError(true);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadRates();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Короткая текстовая строка, чтобы поместилась в шапке
  // Можно стилизовать через .navbar-small-text и .navbar-currency-widget в Navbar.css

  if (loading) {
    return (
      <div className="navbar-small-text navbar-currency-widget">
        Курсы…
      </div>
    );
  }

  if (error || !rates.length) {
    return (
      <div className="navbar-small-text navbar-currency-widget">
        Курсы: —
      </div>
    );
  }

  return (
    <div className="navbar-small-text navbar-currency-widget">
      {rates.map((rate, index) => (
        <span key={rate.code || index}>
          {rate.code}: {rate.value.toFixed(2)}
          {index !== rates.length - 1 ? " · " : ""}
        </span>
      ))}
    </div>
  );
};

export default CurrencyWidget;
