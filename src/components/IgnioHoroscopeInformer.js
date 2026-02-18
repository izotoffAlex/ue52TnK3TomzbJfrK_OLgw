// Путь: frontend/src/components/IgnioHoroscopeInformer.js
// Назначение: Реальный гороскоп Ignio.com (русский) с интерфейсом.
//
// ФИКС (2026-01-01):
// ✅ Карточка слева растягивается по высоте как правая (h-full)
// ✅ Элементы внутри распределены равномерно по высоте (одинаковые промежутки) через justify-content: space-between
// ✅ Текстовый блок НЕ раздувается: ограничена высота + overflow auto (скролл внутри)
// ✅ Источник показываем 1 раз.

import React, { useEffect, useMemo, useRef, useState } from "react";

const IGNIO_SCRIPT_SRC = "//img.ignio.com/r/export/utf/informer/daily/com.js";

const DAYS = [
  { idx: 0, value: "yesterday", label: "Вчера" },
  { idx: 1, value: "today", label: "Сегодня" },
  { idx: 2, value: "tomorrow", label: "Завтра" },
];

const SIGNS = [
  { idx: 0, value: "aries", label: "Овен", glyph: "♈" },
  { idx: 1, value: "taurus", label: "Телец", glyph: "♉" },
  { idx: 2, value: "gemini", label: "Близнецы", glyph: "♊" },
  { idx: 3, value: "cancer", label: "Рак", glyph: "♋" },
  { idx: 4, value: "leo", label: "Лев", glyph: "♌" },
  { idx: 5, value: "virgo", label: "Дева", glyph: "♍" },
  { idx: 6, value: "libra", label: "Весы", glyph: "♎" },
  { idx: 7, value: "scorpio", label: "Скорпион", glyph: "♏" },
  { idx: 8, value: "sagittarius", label: "Стрелец", glyph: "♐" },
  { idx: 9, value: "capricorn", label: "Козерог", glyph: "♑" },
  { idx: 10, value: "aquarius", label: "Водолей", glyph: "♒" },
  { idx: 11, value: "pisces", label: "Рыбы", glyph: "♓" },
];

function normalizeIgnioText(raw) {
  const s = String(raw || "").replace(/\r/g, "").trim();
  if (!s) return { titleLine: "", body: "" };

  let lines = s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  // Убираем строки со ссылками ignio (источник показываем отдельно)
  lines = lines.filter((ln) => !/ignio\.com/i.test(ln));

  const titleLine = lines[0] || "";
  const body = lines.slice(1).join("\n").trim();

  return { titleLine, body };
}

export default function IgnioHoroscopeInformer({
  variant = "sidebar", // "sidebar" | "page"
  defaultSign = "capricorn",
  defaultDay = "today",
}) {
  const isPage = variant === "page";

  const [signValue, setSignValue] = useState(defaultSign);
  const [dayValue, setDayValue] = useState(defaultDay);

  const [ready, setReady] = useState(false);
  const [titleLine, setTitleLine] = useState("");
  const [body, setBody] = useState("");

  const formRef = useRef(null);
  const textareaRef = useRef(null);

  const signObj = useMemo(
    () => SIGNS.find((s) => s.value === signValue) || SIGNS[9],
    [signValue]
  );
  const dayObj = useMemo(
    () => DAYS.find((d) => d.value === dayValue) || DAYS[1],
    [dayValue]
  );

  // Подгружаем скрипт Ignio один раз
  useEffect(() => {
    const attr = "data-ignio-informer-daily-com";
    const existing = document.querySelector(`script[${attr}="1"]`);
    if (existing) {
      setReady(true);
      return;
    }

    const s = document.createElement("script");
    s.src = IGNIO_SCRIPT_SRC;
    s.async = true;
    s.charset = "utf-8";
    s.setAttribute(attr, "1");
    s.onload = () => setReady(true);
    s.onerror = () => setReady(false);
    document.body.appendChild(s);
  }, []);

  // Вызываем igniorun при смене знака/дня
  useEffect(() => {
    if (!ready) return;

    const f = formRef.current;
    if (!f) return;

    if (f.igniosign) f.igniosign.selectedIndex = signObj.idx;
    if (f.ignioday) f.ignioday.selectedIndex = dayObj.idx;

    try {
      if (typeof window.igniorun === "function") {
        window.igniorun(signObj.idx, dayObj.idx);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Ignio igniorun failed:", e);
    }
  }, [ready, signObj.idx, dayObj.idx]);

  // Считываем textarea.value и отображаем в нашем UI
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    let last = "";
    const id = setInterval(() => {
      const v = ta.value || "";
      if (v && v !== last) {
        last = v;
        const parsed = normalizeIgnioText(v);
        setTitleLine(parsed.titleLine);
        setBody(parsed.body);
      }
    }, 400);

    return () => clearInterval(id);
  }, []);

  // Внешняя оболочка (на странице — без лишней рамки)
  const outerStyle = isPage
    ? { backgroundColor: "transparent", border: "none", padding: 0, height: "100%" }
    : {
        backgroundColor: "var(--bg-card, #111418)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 18px 45px rgba(0,0,0,0.12)",
      };

  return (
    <div className={isPage ? "h-full" : "rounded-2xl p-4 md:p-5"} style={outerStyle}>
      {!isPage && (
        <>
          <h2 className="text-xl font-semibold mb-1">Гороскоп</h2>
          <p className="text-xs opacity-70 mb-4">реальный гороскоп (Ignio.com)</p>
        </>
      )}

      {/* ОСНОВНАЯ КАРТОЧКА */}
      <div
        className="rounded-2xl p-4 md:p-5 h-full"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.03), rgba(0,0,0,0.00))",
          border: "1px solid rgba(0,0,0,0.10)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.10)",
        }}
      >
        {/* Равномерные промежутки между блоками */}
        <div className="h-full flex flex-col" style={{ justifyContent: "space-between" }}>
          {/* 1) ШАПКА */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-2xl"
                  style={{
                    width: 48,
                    height: 48,
                    background: "rgba(212, 175, 55, 0.14)",
                    border: "1px solid rgba(212, 175, 55, 0.30)",
                    fontSize: 22,
                  }}
                  aria-hidden="true"
                  title={signObj.label}
                >
                  {signObj.glyph}
                </div>

                <div>
                  <div className="text-base font-semibold leading-tight">
                    {signObj.label} <span className="opacity-60">•</span> {dayObj.label}
                  </div>
                  <div className="text-xs opacity-70 mt-0.5">
                    {titleLine ? titleLine : "Загрузка прогноза…"}
                  </div>
                </div>
              </div>

              {/* ЕДИНСТВЕННЫЙ источник */}
              <a
                href="https://www.ignio.com/"
                target="_blank"
                rel="noreferrer"
                className="text-xs"
                style={{
                  color: "var(--brand-accent, #d4af37)",
                  whiteSpace: "nowrap",
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(212,175,55,0.25)",
                  background: "rgba(212,175,55,0.10)",
                }}
                title="Открыть Ignio.com"
              >
                Источник: Ignio.com
              </a>
            </div>
          </div>

          {/* 2) ТАБЫ ДНЯ */}
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((d) => {
              const active = d.value === dayValue;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDayValue(d.value)}
                  className="px-3 py-2 rounded-2xl text-sm cursor-pointer"
                  style={{
                    border: active
                      ? "1px solid rgba(212,175,55,0.55)"
                      : "1px solid rgba(0,0,0,0.14)",
                    background: active
                      ? "rgba(212,175,55,0.18)"
                      : "linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.02))",
                    boxShadow: active ? "0 10px 18px rgba(0,0,0,0.10)" : "none",
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* 3) СЕЛЕКТ ЗНАКА */}
          <div>
            <label className="block text-xs opacity-70 mb-1">Знак зодиака</label>
            <select
              className="w-full border rounded-2xl px-3 py-3 text-sm cursor-pointer"
              style={{
                borderColor: "rgba(0,0,0,0.14)",
                background: "linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.02))",
                boxShadow: "0 10px 18px rgba(0,0,0,0.06)",
                color: "var(--app-text, #111)",
              }}
              value={signValue}
              onChange={(e) => setSignValue(e.target.value)}
            >
              {SIGNS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* 4) ТЕКСТ: фикс высоты + скролл */}
          <div>
            <div
              className="rounded-2xl p-4 md:p-5 text-sm leading-relaxed w-full"
              style={{
                background: "rgba(255,255,255,0.60)",
                border: "1px solid rgba(0,0,0,0.10)",
                boxShadow: "0 16px 40px rgba(0,0,0,0.08)",
                whiteSpace: "pre-wrap",
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {body ? body : "Загрузка текста…"}
            </div>

            {!ready && (
              <div className="mt-3 text-xs opacity-70">
                Скрипт Ignio не загрузился (часто блокируется AdBlock). Попробуйте отключить блокировщик
                для сайта.
              </div>
            )}
          </div>
        </div>

        {/* Скрытая форма для Ignio */}
        <div style={{ position: "absolute", left: "-99999px", top: "-99999px" }}>
          <form name="igniohscope" ref={formRef}>
            <select name="igniosign" defaultValue={String(signObj.idx)}>
              {SIGNS.map((s) => (
                <option key={s.idx} value={String(s.idx)}>
                  {s.label}
                </option>
              ))}
            </select>

            <select name="ignioday" defaultValue={String(dayObj.idx)}>
              {DAYS.map((d) => (
                <option key={d.idx} value={String(d.idx)}>
                  {d.label}
                </option>
              ))}
            </select>

            <textarea name="igniotext" ref={textareaRef} defaultValue="" />
          </form>
        </div>
      </div>
    </div>
  );
}
