// Путь: frontend/src/components/ShareBar.js
// Назначение: Переиспользуемый блок "Поделиться" (VK/OK/TG/WA + MAX + избранное).
// ФИКС (2026-01-02):
// ✅ Добавлена кнопка "MAX".
//    - Если сайт открыт внутри MAX (мини-приложение) и доступен window.WebApp.shareContent(text, link) — используем его.
//    - Иначе пытаемся navigator.share() (мобилки).
//    - Иначе копируем ссылку в буфер и показываем подсказку.

import React, { useMemo, useState } from "react";
import FavoriteHeart from "./FavoriteHeart";

async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // fallback ниже
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function ShareBar({
  url = "",
  text = "",
  slug = "",
  btnStyle = null,
  showFavorite = true,
  className = "",
}) {
  const [hint, setHint] = useState("");

  const enc = useMemo(() => {
    const u = encodeURIComponent(url || "");
    const t = encodeURIComponent(text || "");
    return { u, t };
  }, [url, text]);

  const vkHref = `https://vk.com/share.php?url=${enc.u}&title=${enc.t}`;
  const okHref = `https://connect.ok.ru/offer?url=${enc.u}&title=${enc.t}`;
  const tgHref = `https://t.me/share/url?url=${enc.u}&text=${enc.t}`;
  const waHref = `https://api.whatsapp.com/send?text=${enc.t}%20${enc.u}`;

  const onShareMax = async () => {
    setHint("");

    const shareText = text || "IzotovLife";
    const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

    // 1) Если открыто внутри MAX мини-приложения: используем официальный bridge
    try {
      if (
        typeof window !== "undefined" &&
        window.WebApp &&
        typeof window.WebApp.shareContent === "function"
      ) {
        window.WebApp.shareContent(shareText, shareUrl);
        return;
      }
    } catch (e) {
      // идём дальше
    }

    // 2) Нативный шаринг на мобильных (пользователь выберет MAX в системном меню)
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function" && shareUrl) {
        await navigator.share({
          title: shareText,
          text: shareText,
          url: shareUrl,
        });
        return;
      }
    } catch (e) {
      // пользователь мог нажать "отмена" — не считаем ошибкой
      return;
    }

    // 3) Фоллбек: копируем ссылку
    const ok = await copyToClipboard(shareUrl);
    setHint(ok ? "Ссылка скопирована. Открой MAX и вставь в чат." : "Не удалось скопировать ссылку.");
    setTimeout(() => setHint(""), 2200);
  };

  return (
    <div
      className={["sharebar", className].filter(Boolean).join(" ")}
      style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
      aria-label="Поделиться"
    >
      {showFavorite ? (
        <FavoriteHeart slug={slug} kind="sharebar" style={btnStyle || undefined} />
      ) : null}

      <a
        href={vkHref}
        target="_blank"
        rel="noopener noreferrer"
        style={btnStyle || undefined}
        title="Поделиться во ВКонтакте"
      >
        VK
      </a>

      <a
        href={okHref}
        target="_blank"
        rel="noopener noreferrer"
        style={btnStyle || undefined}
        title="Поделиться в Одноклассниках"
      >
        OK
      </a>

      <a
        href={tgHref}
        target="_blank"
        rel="noopener noreferrer"
        style={btnStyle || undefined}
        title="Поделиться в Telegram"
      >
        TG
      </a>

      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        style={btnStyle || undefined}
        title="Поделиться в WhatsApp"
      >
        WA
      </a>

      {/* ✅ MAX */}
      <button
        type="button"
        onClick={onShareMax}
        style={btnStyle || undefined}
        title="Поделиться в MAX"
      >
        MAX
      </button>

      {hint ? (
        <span style={{ fontSize: 12, opacity: 0.8, marginLeft: 6 }}>{hint}</span>
      ) : null}
    </div>
  );
}
