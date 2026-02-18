// Путь: frontend/src/components/HoroscopeWidget.js
// Назначение: Виджет гороскопа (для главной и страницы /horoscope).
//
// ИЗМЕНЕНИЯ (2026-01-02):
// ✅ Добавлены символы знаков (♈♉♊...) и отображение выбранного символа рядом с "Сейчас:".
// ✅ В выпадающем списке (select) показываем "♈ Овен" и т.п.
// ✅ Сохранили controlled-логику sign/day и анти-кеш запросов.
// ✅ Ничего старого не удаляли — только добавили символы и их вывод.

import React, { useEffect, useMemo, useState } from "react";
import styles from "./HoroscopeWidget.module.css";

const API_URL = "/api/horoscope/";

// ✅ Добавили symbol для каждого знака
const SIGNS = [
  { value: "aries", label: "Овен", symbol: "♈" },
  { value: "taurus", label: "Телец", symbol: "♉" },
  { value: "gemini", label: "Близнецы", symbol: "♊" },
  { value: "cancer", label: "Рак", symbol: "♋" },
  { value: "leo", label: "Лев", symbol: "♌" },
  { value: "virgo", label: "Дева", symbol: "♍" },
  { value: "libra", label: "Весы", symbol: "♎" },
  { value: "scorpio", label: "Скорпион", symbol: "♏" },
  { value: "sagittarius", label: "Стрелец", symbol: "♐" },
  { value: "capricorn", label: "Козерог", symbol: "♑" },
  { value: "aquarius", label: "Водолей", symbol: "♒" },
  { value: "pisces", label: "Рыбы", symbol: "♓" },
];

const DAYS = [
  { value: "today", label: "Сегодня" },
  { value: "tomorrow", label: "Завтра" },
];

function safeSign(v) {
  return SIGNS.some((s) => s.value === v) ? v : "aries";
}
function safeDay(v) {
  return v === "tomorrow" ? "tomorrow" : "today";
}

export default function HoroscopeWidget({
  variant = "home",
  // controlled:
  sign: controlledSign,
  day: controlledDay,
  onSignChange,
  onDayChange,
  // uncontrolled defaults:
  defaultSign = "aries",
  defaultDay = "today",
}) {
  const [innerSign, setInnerSign] = useState(() => safeSign(defaultSign));
  const [innerDay, setInnerDay] = useState(() => safeDay(defaultDay));

  const sign = safeSign(controlledSign !== undefined ? controlledSign : innerSign);
  const day = safeDay(controlledDay !== undefined ? controlledDay : innerDay);

  const setSign = (v) => {
    const next = safeSign(v);
    if (typeof onSignChange === "function") onSignChange(next);
    if (controlledSign === undefined) setInnerSign(next);
  };

  const setDay = (v) => {
    const next = safeDay(v);
    if (typeof onDayChange === "function") onDayChange(next);
    if (controlledDay === undefined) setInnerDay(next);
  };

  // если где-то прилетит "yesterday" — фиксируем на today
  useEffect(() => {
    if (day === "yesterday") setDay("today");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const signObj = useMemo(() => SIGNS.find((s) => s.value === sign) || SIGNS[0], [sign]);
  const signLabel = signObj?.label || "";
  const signSymbol = signObj?.symbol || "";

  const dayLabel = useMemo(() => DAYS.find((d) => d.value === day)?.label || "", [day]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const qs = new URLSearchParams();
        qs.set("sign", sign);
        qs.set("day", day);
        qs.set("_ts", String(Date.now())); // анти-кеш

        const res = await fetch(`${API_URL}?${qs.toString()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache", Accept: "application/json" },
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json?.detail || json?.error || `Ошибка загрузки (${res.status})`);
        }

        if (!ignore) setPayload(json);
      } catch (e) {
        if (!ignore) {
          setError(e?.message || "Не удалось загрузить прогноз");
          setPayload(null);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [sign, day]);

  const data = payload?.data || null;
  const dateText = String((data?.date || payload?.date || "") ?? "");
  const descriptionText = String(
    (data?.description || payload?.description || data?.text || payload?.text || "") ?? ""
  );

  const sourceRaw = String(data?.source || payload?.source || "ignio.com").toLowerCase();
  const isIgnio = sourceRaw.includes("ignio");

  const isPage = variant === "page";

  return (
    <div className={isPage ? styles.wrapPage : styles.wrap}>
      <div className={styles.grid}>
        {/* Левая панель выбора */}
        <div className={styles.panel}>
          <div className={styles.panelInner}>
            <div className={styles.title}>Персональный прогноз</div>

            {/* ✅ Символ знака в нужном месте (рядом с "Сейчас") */}
            <div className={styles.metaRow}>
              <span className={styles.signBadge} aria-hidden="true" title={signLabel}>
                {signSymbol}
              </span>
              <div className={styles.meta}>
                Сейчас: <b>{signLabel}</b> • <span>{dayLabel}</span>
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.label}>Знак зодиака</div>
              <select className={styles.select} value={sign} onChange={(e) => setSign(e.target.value)}>
                {SIGNS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.symbol} {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <div className={styles.label}>День</div>
              <div className={styles.days}>
                {DAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    className={`${styles.dayBtn} ${day === d.value ? styles.dayBtnActive : ""}`}
                    onClick={() => setDay(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.bottomNote}>
              Источник:{" "}
              {isIgnio ? (
                <a href="https://ignio.com" target="_blank" rel="noreferrer">
                  Ignio.com
                </a>
              ) : (
                <span>Ignio.com</span>
              )}
            </div>
          </div>
        </div>

        {/* Правая карточка результата */}
        <div className={styles.result}>
          {loading && <div className={styles.loading}>Загрузка…</div>}
          {!loading && error && <div className={styles.error}>{error}</div>}

          {!loading && !error && descriptionText && (
            <div className={styles.resultInner}>
              {dateText ? <div className={styles.date}>Дата: {dateText}</div> : null}
              <div className={styles.text}>{descriptionText}</div>
            </div>
          )}

          {!loading && !error && !descriptionText && <div className={styles.loading}>Нет данных</div>}
        </div>
      </div>
    </div>
  );
}
