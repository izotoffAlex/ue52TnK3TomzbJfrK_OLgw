// Путь: frontend/src/components/FavoriteHeart.jsx
// Назначение: Кнопка "В избранное" (иконка-сердце) для статей.
//
// Изменения (редкий кейс удаления кода — обязательно для корректной сборки):
//   ❌ УДАЛЁН неиспользуемый стейт `authKnown` (давал ESLint: 'authKnown' is assigned a value but never used).
//   ✅ Проп `kind` используется как data-атрибут `data-kind` (чтобы не было предупреждений о неиспользуемом пропе).
//   ✅ Остальной функционал без изменений: проверка/переключение избранного через V2-обёртку, редирект гостей на логин.

import React, { useEffect, useState } from "react";
import { AiFillHeart, AiOutlineHeart } from "react-icons/ai";
import {
  favoritesCheckV2,
  favoritesToggleV2,
  FRONTEND_LOGIN_URL,
} from "../api/favoritesV2";

export default function FavoriteHeart({
  slug,
  className = "",
  style = {},
  titleOn = "Убрать из избранного",
  titleOff = "В избранное",
  kind = "default",
}) {
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) {
        setLoading(false);
        return;
      }
      try {
        const res = await favoritesCheckV2(slug);
        if (cancelled) return;
        setIsFav(Boolean(res?.exists));
      } catch {
        // гость или иная ошибка — UI останется "не в избранном"
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleClick = async (ev) => {
    ev.preventDefault();
    if (!slug) return;

    try {
      setLoading(true);
      const res = await favoritesToggleV2(slug);
      setIsFav(Boolean(res?.exists));
    } catch (e) {
      if (e && e.__unauth) {
        try {
          window.location.assign(FRONTEND_LOGIN_URL || "/login");
          return;
        } catch {
          window.location.href = FRONTEND_LOGIN_URL || "/login";
          return;
        }
      }
      // другие ошибки молча игнорируем
    } finally {
      setLoading(false);
    }
  };

  const commonProps = {
    type: "button",
    onClick: handleClick,
    className,
    "data-kind": kind,
    style: {
      width: 34,
      height: 34,
      borderRadius: 999,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      border: "1px solid rgba(0,0,0,0.15)",
      background: "transparent",
      cursor: loading ? "default" : "pointer",
      opacity: loading ? 0.6 : 1,
      ...style,
    },
    "aria-pressed": isFav ? "true" : "false",
    title: isFav ? titleOn : titleOff,
  };

  return (
    <button {...commonProps} disabled={loading}>
      {isFav ? <AiFillHeart /> : <AiOutlineHeart />}
    </button>
  );
}
