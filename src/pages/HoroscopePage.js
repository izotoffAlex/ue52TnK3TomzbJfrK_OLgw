// Путь: frontend/src/pages/HoroscopePage.js
// Назначение: Страница /horoscope.
//
// ИЗМЕНЕНИЯ (2026-01-02):
// ✅ Заголовок вкладки (document.title) исправлен: больше не как на главной
// ✅ Ссылка "Поделиться" теперь включает выбранные sign/day: /horoscope?sign=capricorn&day=today
// ✅ При выборе знака/дня URL обновляется (replace), чтобы можно было копировать/делиться 1:1
// ✅ Выровняли высоту верхних карточек: вынесли "Дисклеймер" из правой карточки в отдельную карточку ниже
// ✅ Типографика справа подогнана под левую карточку: текст 14px, заголовки 16px
// ✅ (НОВОЕ) Визуально выровняли суммарную высоту левой/правой колонок:
//    карточка "Поделиться" теперь растягивается на высоту строки (h-full + flex)

import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import HoroscopeWidget from "../components/HoroscopeWidget";
import FavoriteHeart from "../components/FavoriteHeart";

import { FiLink } from "react-icons/fi";
import { FaVk, FaTelegramPlane, FaWhatsapp, FaOdnoklassniki } from "react-icons/fa";

const SIGNS = [
  { value: "aries", label: "Овен" },
  { value: "taurus", label: "Телец" },
  { value: "gemini", label: "Близнецы" },
  { value: "cancer", label: "Рак" },
  { value: "leo", label: "Лев" },
  { value: "virgo", label: "Дева" },
  { value: "libra", label: "Весы" },
  { value: "scorpio", label: "Скорпион" },
  { value: "sagittarius", label: "Стрелец" },
  { value: "capricorn", label: "Козерог" },
  { value: "aquarius", label: "Водолей" },
  { value: "pisces", label: "Рыбы" },
];

function safeSign(v) {
  return SIGNS.some((s) => s.value === v) ? v : "aries";
}
function safeDay(v) {
  return v === "tomorrow" ? "tomorrow" : "today";
}
function dayLabel(v) {
  return v === "tomorrow" ? "Завтра" : "Сегодня";
}

// Блок "Поделиться" — как на детальной новости, но с URL, который мы передаём (shareHref)
function ShareButtons({ title, slug, shareHref }) {
  const [copied, setCopied] = useState(false);

  const href = shareHref || (typeof window !== "undefined" ? window.location.href : "");
  const url = encodeURIComponent(href || "");
  const text = encodeURIComponent(title || (typeof document !== "undefined" ? document.title : "") || "");

  // ВАЖНО: никаких #fff/#111 — всё наследуем от темы
  const btnStyle = {
    width: 38,
    height: 38,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(127,127,127,0.35)",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    textDecoration: "none",
  };

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  async function shareToMax() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: title || (typeof document !== "undefined" ? document.title : ""),
          text: title || "",
          url: href,
        });
        return;
      }
    } catch {
      // ignore
    }
    copyLink();
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <FavoriteHeart slug={slug} kind="sharebar" style={btnStyle} />

      <a
        href={`https://vk.com/share.php?url=${url}&title=${text}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Поделиться во ВКонтакте"
        style={btnStyle}
      >
        <FaVk />
      </a>

      <a
        href={`https://connect.ok.ru/offer?url=${url}&title=${text}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Поделиться в Одноклассниках"
        style={btnStyle}
      >
        <FaOdnoklassniki />
      </a>

      <a
        href={`https://t.me/share/url?url=${url}&text=${text}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Поделиться в Telegram"
        style={btnStyle}
      >
        <FaTelegramPlane />
      </a>

      <a
        href={`https://wa.me/?text=${text}%20${url}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Поделиться в WhatsApp"
        style={btnStyle}
      >
        <FaWhatsapp />
      </a>

      <button
        type="button"
        onClick={shareToMax}
        title="Поделиться в MAX"
        style={{ ...btnStyle, fontWeight: 800, fontSize: 11, letterSpacing: 0.4 }}
      >
        MAX
      </button>

      <button
        type="button"
        onClick={copyLink}
        title={copied ? "Скопировано!" : "Скопировать ссылку"}
        style={btnStyle}
      >
        <FiLink />
      </button>
    </div>
  );
}

export default function HoroscopePage() {
  const location = useLocation();
  const navigate = useNavigate();

  // 1) Инициализируем sign/day из URL
  const initial = useMemo(() => {
    const qs = new URLSearchParams(location.search || "");
    const s = safeSign(qs.get("sign"));
    const d = safeDay(qs.get("day"));
    return { s, d };
  }, [location.search]);

  const [sign, setSign] = useState(initial.s);
  const [day, setDay] = useState(initial.d);

  // 2) Если пользователь пришёл по ссылке с параметрами — синхронизируем state
  useEffect(() => {
    setSign(initial.s);
    setDay(initial.d);
  }, [initial.s, initial.d]);

  // 3) При изменении выбора — обновляем URL (replace), чтобы копирование работало 1:1
  useEffect(() => {
    const qs = new URLSearchParams();
    qs.set("sign", safeSign(sign));
    qs.set("day", safeDay(day));
    navigate({ pathname: "/horoscope", search: `?${qs.toString()}` }, { replace: true });
  }, [sign, day, navigate]);

  // 4) Заголовок вкладки — исправляем
  useEffect(() => {
    document.title = "Гороскоп на сегодня и завтра | IzotovLife";
  }, []);

  const signLabel = useMemo(() => SIGNS.find((s) => s.value === sign)?.label || "Овен", [sign]);
  const dayText = useMemo(() => dayLabel(day), [day]);

  // 5) Ссылка для “Поделиться” (важно: именно с выбранными sign/day)
  const shareHref = useMemo(() => {
    if (typeof window === "undefined") return "";
    const qs = new URLSearchParams();
    qs.set("sign", safeSign(sign));
    qs.set("day", safeDay(day));
    return `${window.location.origin}/horoscope?${qs.toString()}`;
  }, [sign, day]);

  const shareTitle = useMemo(() => `Гороскоп: ${signLabel} • ${dayText} — IzotovLife`, [signLabel, dayText]);

  const cardBorder = { border: "1px solid rgba(127,127,127,0.18)" };

  // Единая типографика правых карточек (как в виджете слева)
  const asideTitleClass = "text-[16px] font-semibold mb-3";
  const asideTextClass = "text-[14px] leading-[1.55]";

  return (
    <div className="max-w-6xl mx-auto px-3 md:px-6 pt-6 pb-16">
      <div className="text-sm opacity-70 mb-2">
        Главная <span className="opacity-50">/</span> Гороскоп
      </div>

      <h1 className="sr-only">Гороскоп на сегодня и завтра</h1>

      <div className="text-3xl md:text-4xl font-bold mb-2">Гороскоп на сегодня и завтра</div>
      <div className="opacity-80 mb-6">
        Выберите знак и день, чтобы увидеть прогноз. Текст обновляется автоматически.
      </div>

      {/* 2 ряда:
          Ряд 1: [виджет (2 колонки)] + [Как читать прогноз]
          Ряд 2: [Поделиться (2 колонки)] + [Дисклеймер]
      */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Ряд 1 (слева): виджет */}
        <div className="lg:col-span-2">
          <HoroscopeWidget variant="page" sign={sign} day={day} onSignChange={setSign} onDayChange={setDay} />
        </div>

        {/* Ряд 1 (справа): как читать */}
        <aside className="rounded-2xl p-4 md:p-5 h-full" style={cardBorder}>
          <div className={asideTitleClass}>Как читать прогноз</div>

          <ul className={`space-y-2 list-disc pl-5 ${asideTextClass}`} style={{ opacity: 0.92 }}>
            <li>
              Выберите <b>знак и день</b> — прогноз меняется сразу.
            </li>
            <li>
              “Сегодня” — основной прогноз, “Завтра” — продолжение и контекст.
            </li>
            <li>Используйте прогноз как подсказку, а не как “жёсткое предсказание”.</li>
          </ul>
        </aside>

        {/* Ряд 2 (слева): поделиться (ВАЖНО: растягиваем карточку по высоте строки) */}
        <div className="lg:col-span-2 h-full">
          <div
            className="rounded-2xl p-4 md:p-5 h-full flex flex-col"
            style={{ border: "1px solid rgba(127,127,127,0.20)" }}
          >
            <div className="text-base font-semibold mb-3">Поделиться</div>

            {/* Иконки — сверху, а оставшееся место пусть будет воздухом (но карточка по высоте равна правой) */}
            <div style={{ color: "var(--app-text, inherit)" }}>
              <ShareButtons title={shareTitle} slug={`horoscope:${sign}:${day}`} shareHref={shareHref} />
            </div>

            {/* Спейсер, чтобы карточка выглядела естественно при растяжении */}
            <div className="flex-1" />
          </div>
        </div>

        {/* Ряд 2 (справа): дисклеймер */}
        <aside className="rounded-2xl p-4 md:p-5 h-full" style={cardBorder}>
          <div className={asideTitleClass}>Дисклеймер</div>

          <div className={asideTextClass} style={{ opacity: 0.92 }}>
            Гороскоп — развлекательный формат. Совпадения и инсайты возможны, но решения всё равно принимаете вы.
          </div>

          <div className={`mt-6 ${asideTextClass}`} style={{ opacity: 0.75 }}>
            Источник указан внутри карточки прогноза (Ignio.com). Если прогноз не загружается, иногда причина —
            блокировщик рекламы.
          </div>
        </aside>
      </div>
    </div>
  );
}
