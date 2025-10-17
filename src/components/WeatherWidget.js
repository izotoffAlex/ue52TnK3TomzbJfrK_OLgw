// Путь: frontend/src/components/WeatherWidget.js
// Назначение: Виджет погоды для шапки сайта IzotovLife.
// Обновления (устранён ESLint warning):
//   ✅ loadByCity обёрнут в useCallback (стабильная ссылка).
//   ✅ useEffect теперь зависит от [loadByCity, city] — предупреждение исчезает.
//   ✅ Остальной функционал без изменений: кэш (30 мин), подсказки, автообновление, фолбэки.
//   ❗ Ничего лишнего не удалял; заменил прямой вызов на мемоизированный, что требуется для корректной работы правил хуков.

import React, { useEffect, useRef, useState, useCallback } from "react";
import "./WeatherWidget.css";

/* ---------- Константы и утилиты ---------- */

const ENV_CITY = (process.env.REACT_APP_WEATHER_CITY || "").trim();
const DEFAULT_CITY = ENV_CITY || "Москва";

const MOSCOW_COORDS = { lat: 55.7558, lon: 37.6173, name: "Москва" };

const CACHE_KEY = "WEATHER_CACHE_V3";
const CACHE_TTL = 30 * 60 * 1000; // 30 минут

// В кэше храним: { area, temp, desc, pressure, wind, fetchedAt }
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.fetchedAt) return null;
    return obj;
  } catch {
    return null;
  }
}
function writeCache(obj) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {}
}

// Значения, которые не являются правильным названием города
const BAD_NAMES = new Set([
  "ваш город",
  "your city",
  "город",
  "undefined",
  "null",
  "none",
  "—",
  "-",
]);

function isInvalidCityName(x) {
  if (!x) return true;
  const s = String(x).trim().toLowerCase();
  if (!s) return true;
  if (BAD_NAMES.has(s)) return true;
  if (!/[a-zа-яё]/i.test(s)) return true; // только небуквенные символы
  if (s.length < 2) return true;
  return false;
}

function sanitizeCityName(x) {
  if (isInvalidCityName(x)) return DEFAULT_CITY;
  return String(x).trim();
}

// Карта кодов погоды
const weatherNames = {
  0: "Ясно ☀️",
  1: "Преим. ясно 🌤",
  2: "Переменная облачность ⛅",
  3: "Пасмурно ☁️",
  45: "Туман 🌫️",
  48: "Изморось 🌫️",
  51: "Морось 🌦️",
  53: "Морось 🌦️",
  55: "Морось 🌦️",
  61: "Дождь 🌧️",
  63: "Сильный дождь 🌧️",
  65: "Ливень 🌧️",
  66: "Ледяной дождь 🌧️",
  67: "Сильный лед. дождь 🌧️",
  71: "Снег 🌨️",
  73: "Снег 🌨️",
  75: "Снегопад ❄️",
  80: "Кратковременный дождь 🌦️",
  81: "Ливни ⛈️",
  82: "Сильные ливни ⛈️",
  85: "Снегопад 🌨️",
  86: "Сильный снег ❄️",
  95: "Гроза ⚡",
  96: "Гроза с градом ⛈️",
  99: "Гроза с крупным градом ⛈️",
};

/* ---------- Компонент ---------- */

export default function WeatherWidget() {
  // Берём город из localStorage, но сразу санитизируем
  const storedCity = sanitizeCityName(localStorage.getItem("weatherCity"));
  const [city, setCity] = useState(storedCity);
  const [suggestions, setSuggestions] = useState([]);
  const [weather, setWeather] = useState(null);
  const [fade, setFade] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(""); // текст ошибки
  const [manualMode, setManualMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const debounceRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const abortRef = useRef(null);

  /* ---------- Вспомогательные функции запроса ---------- */

  const geocodeCity = useCallback(async (cityName, signal) => {
    const q = sanitizeCityName(cityName);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          q
        )}&count=1&language=ru`,
        { signal }
      );
      if (!res.ok) return null;
      const geo = await res.json();
      const first = geo?.results?.[0];
      if (!first?.latitude || !first?.longitude) return null;
      return {
        lat: Number(first.latitude),
        lon: Number(first.longitude),
        name: first.name || q,
      };
    } catch {
      return null;
    }
  }, []);

  const fetchWeatherByCoords = useCallback(async (lat, lon, placeName, signal) => {
    const u =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true&hourly=pressure_msl&windspeed_unit=ms` +
      `&timezone=auto`;

    const r = await fetch(u, { signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    const cw = data?.current_weather;
    if (!cw || typeof cw.temperature !== "number") {
      throw new Error("Нет current_weather");
    }

    // Давление из hourly (гПа → мм рт. ст.)
    let pressureMm = null;
    const hTimes = data?.hourly?.time || [];
    const hPress = data?.hourly?.pressure_msl || [];
    if (hTimes.length && hPress.length) {
      const nowIso = cw?.time || new Date().toISOString().slice(0, 13) + ":00";
      let idx = hTimes.indexOf(nowIso);
      if (idx < 0) {
        const now = new Date(nowIso).getTime();
        let best = 0,
          bestDiff = Infinity;
        for (let i = 0; i < hTimes.length; i++) {
          const diff = Math.abs(new Date(hTimes[i]).getTime() - now);
          if (diff < bestDiff) {
            bestDiff = diff;
            best = i;
          }
        }
        idx = best;
      }
      const hPa = Number(hPress[idx]);
      if (Number.isFinite(hPa)) pressureMm = Math.round(hPa * 0.75006);
    }

    const desc = weatherNames[Number(cw.weathercode)] || "Погода";
    return {
      area: placeName,
      temp: Math.round(Number(cw.temperature)),
      desc,
      pressure: pressureMm,
      wind: Math.round(Number(cw.windspeed || 0)),
      fetchedAt: Date.now(),
    };
  }, []);

  /* ---------- Главная функция загрузки (useCallback) ---------- */

  const loadByCity = useCallback(
    async (cityName, opts = {}) => {
      const { preferCacheFirst = false } = opts;

      // Показать кэш сразу — чтобы не было пустоты
      if (preferCacheFirst) {
        const cached = readCache();
        if (cached) {
          const stale = Date.now() - cached.fetchedAt > CACHE_TTL;
          setWeather({ ...cached, stale });
          setFade(true);
        }
      }

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError("");

      // Шаг 1. Пробуем геокодить «как есть» (но санитизированный)
      let target = await geocodeCity(cityName, controller.signal);

      // Шаг 2. Если не нашли — пробуем DEFAULT_CITY
      if (!target && sanitizeCityName(cityName) !== DEFAULT_CITY) {
        target = await geocodeCity(DEFAULT_CITY, controller.signal);
        // Заодно поправим localStorage, чтобы в следующий раз не падать
        localStorage.setItem("weatherCity", DEFAULT_CITY);
        setCity(DEFAULT_CITY);
      }

      // Шаг 3. Если всё ещё не нашли — фолбэк на координаты Москвы
      if (!target) {
        target = { ...MOSCOW_COORDS };
        localStorage.setItem("weatherCity", MOSCOW_COORDS.name);
        setCity(MOSCOW_COORDS.name);
      }

      try {
        const payload = await fetchWeatherByCoords(
          target.lat || MOSCOW_COORDS.lat,
          target.lon || MOSCOW_COORDS.lon,
          target.name || MOSCOW_COORDS.name,
          controller.signal
        );

        writeCache(payload);
        setFade(false);
        setTimeout(() => {
          setWeather({ ...payload, stale: false });
          setFade(true);
          setLoading(false);
          setError("");
          setLastUpdated(new Date());
          localStorage.setItem("weatherCity", payload.area);
          setManualMode(false);
        }, 80);
      } catch (e) {
        console.error("Погода (fetch):", e);
        const cached = readCache();
        if (cached) setWeather({ ...cached, stale: true });
        setLoading(false);
        setError("Нет связи • Повторить");
      }
    },
    [geocodeCity, fetchWeatherByCoords]
  );

  /* ---------- Хуки ---------- */

  // Первый запуск: показываем кэш (если есть) и параллельно тянем свежие данные
  useEffect(() => {
    loadByCity(city, { preferCacheFirst: true });
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [loadByCity, city]);

  // Подсказки города
  useEffect(() => {
    if (!manualMode || !city || city.length < 2) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            city
          )}&count=5&language=ru`
        );
        const data = await res.json();
        setSuggestions(data?.results || []);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [city, manualMode]);

  // Автообновление каждые 15 минут
  useEffect(() => {
    if (!city) return;
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(() => {
      loadByCity(city);
    }, 15 * 60 * 1000);
    return () => clearInterval(refreshTimerRef.current);
  }, [city, loadByCity]);

  /* ---------- Рендер ---------- */

  const formatTime = (d) =>
    d ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="weather-widget">
      {/* Кнопки */}
      <button
        onClick={() => setManualMode((m) => !m)}
        title="Выбрать город вручную"
        className="weather-btn"
        aria-label="Выбрать город"
      >
        🌍
      </button>

      <button
        onClick={() => loadByCity(city || DEFAULT_CITY)}
        title="Обновить погоду"
        className={`weather-btn ${loading ? "rotate-icon" : ""}`}
        aria-label="Обновить погоду"
      >
        ⟳
      </button>

      {/* Строка погоды */}
      <div className={`weather-fade ${fade ? "fade-in" : ""}`}>
        {weather ? (
          <>
            <span className="weather-city">
              <strong>{weather.area}</strong>:
            </span>
            <span className="weather-temp">{weather.temp}°C</span>
            <span className="weather-desc">
              {weather.desc} {weather.stale ? "(кэш)" : ""}
            </span>
            {typeof weather.pressure === "number" && (
              <span className="weather-pressure">
                Давл. {weather.pressure} мм рт. ст.
              </span>
            )}
            {typeof weather.wind === "number" && weather.wind > 0 && (
              <span className="weather-wind">Ветер {weather.wind} м/с</span>
            )}
            {lastUpdated && !weather.stale && (
              <span className="weather-time" aria-live="polite">
                Обновлено: {formatTime(lastUpdated)}
              </span>
            )}
          </>
        ) : error ? (
          <button
            className="weather-error-btn"
            onClick={() => loadByCity(city || DEFAULT_CITY)}
            title="Повторить запрос погоды"
          >
            {error}
          </button>
        ) : (
          <span className="weather-placeholder">Загрузка погоды…</span>
        )}
      </div>

      {/* Ручной ввод города */}
      {manualMode && (
        <div className="weather-manual">
          <input
            value={city}
            placeholder="Введите город..."
            onChange={(e) => setCity(e.target.value)}
            className="weather-input"
            autoFocus
          />
          {suggestions.length > 0 && (
            <div className="weather-suggest">
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setCity(s.name);
                    loadByCity(s.name);
                    setSuggestions([]);
                  }}
                  className="weather-suggest-item"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {s.name} {s.country ? `(${s.country})` : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
