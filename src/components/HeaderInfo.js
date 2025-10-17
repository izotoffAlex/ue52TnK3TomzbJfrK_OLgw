// frontend/src/components/HeaderInfo.js
// Назначение: Инфо-панель «Курсы валют + Погода».
// Что изменено:
//   • Вверху выводим жёстко USD и EUR.
//   • Оставлен селектор валют (дополнительно можно выбрать любую).
//   • Убрана искусственная строчка «Доллар + Евро» из селектора.
//   • Погода через Open-Meteo.

import React, { useEffect, useState } from "react";

const cities = [
  { name: "Москва", lat: 55.7558, lon: 37.6176 },
  { name: "Санкт-Петербург", lat: 59.9343, lon: 30.3351 },
  { name: "Казань", lat: 55.7963, lon: 49.1088 },
  { name: "Новосибирск", lat: 55.0084, lon: 82.9357 },
  { name: "Екатеринбург", lat: 56.8389, lon: 60.6057 },
];

export default function HeaderInfo({ active = false }) {
  const [rates, setRates] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState("USD");

  const [weather, setWeather] = useState(null);
  const [selectedCity, setSelectedCity] = useState(
    localStorage.getItem("selectedCity") || ""
  );

  // --- Курсы валют ---
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    async function fetchRates() {
      try {
        const res = await fetch("https://api.exchangerate.host/latest?base=RUB");
        const data = await res.json();
        if (!cancelled) setRates(data?.rates || {});
      } catch (err) {
        console.error("Ошибка загрузки курсов валют:", err);
        if (!cancelled) setRates({});
      }
    }
    fetchRates();
    return () => {
      cancelled = true;
    };
  }, [active]);

  // --- Погода через Open-Meteo ---
  async function loadWeather(lat, lon, cityName = "") {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto&lang=ru`;
      const res = await fetch(url);
      const data = await res.json();
      if (data?.current_weather) {
        setWeather({
          temp: data.current_weather.temperature,
          wind: data.current_weather.windspeed,
          city: cityName || "",
        });
      }
    } catch (err) {
      console.error("Ошибка загрузки погоды:", err);
    }
  }

  // --- выбор города или автоопределение ---
  useEffect(() => {
    if (!active) return;

    if (selectedCity) {
      const cityObj = cities.find((c) => c.name === selectedCity);
      if (cityObj) loadWeather(cityObj.lat, cityObj.lon, cityObj.name);
    } else if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          loadWeather(pos.coords.latitude, pos.coords.longitude, "Моё местоположение"),
        (err) => console.warn("Геолокация отклонена или недоступна:", err)
      );
    }
  }, [active, selectedCity]);

  const handleCityChange = (e) => {
    const city = e.target.value;
    setSelectedCity(city);
    localStorage.setItem("selectedCity", city);
  };

  if (!active) return null;

  return (
    <div className="flex items-center gap-6 text-sm text-gray-200 px-4 py-2 bg-[#111827]">
      {/* Курсы валют */}
      <div className="flex items-center gap-2">
        <span>Курс:</span>
        {!rates ? (
          <span>Загрузка…</span>
        ) : (
          <>
            <span>
              USD:{" "}
              {rates?.USD ? (1 / rates.USD).toFixed(2) + " ₽" : "—"}
            </span>
            <span>
              EUR:{" "}
              {rates?.EUR ? (1 / rates.EUR).toFixed(2) + " ₽" : "—"}
            </span>
            {/* Селектор без пункта "Доллар + Евро" */}
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="bg-[#0b132b] text-white rounded px-1 py-0.5 ml-2"
            >
              {Object.keys(rates)
                .filter((cur) => cur !== "USD" && cur !== "EUR") // исключаем USD/EUR, они уже отдельно показаны
                .map((cur) => (
                  <option key={cur} value={cur}>
                    {cur}
                  </option>
                ))}
            </select>
            {selectedCurrency && (
              <span>
                {selectedCurrency}:{" "}
                {rates?.[selectedCurrency]
                  ? (1 / rates[selectedCurrency]).toFixed(2) + " ₽"
                  : "—"}
              </span>
            )}
          </>
        )}
      </div>

      {/* Погода */}
      <div className="flex items-center gap-2">
        <select
          value={selectedCity}
          onChange={handleCityChange}
          className="bg-[#0b132b] text-white rounded px-1 py-0.5"
        >
          <option value="">Мой город (авто)</option>
          {cities.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        {weather ? (
          <div>
            {weather.city ? weather.city + ": " : ""}
            {typeof weather.temp === "number" ? weather.temp.toFixed(1) : "—"}°C,
            ветер {weather.wind ?? "—"} км/ч
          </div>
        ) : (
          <div>Загрузка погоды…</div>
        )}
      </div>
    </div>
  );
}
