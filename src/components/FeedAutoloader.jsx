// Путь: frontend/src/components/FeedAutoloader.jsx
// Назначение: "умная" автоподгрузка ленты без необходимости скролла.
// Что делает:
//  • Сам создаёт скрытый sentinel в конце контейнера и следит за ним через IntersectionObserver.
//  • Сразу после первого рендера пытается ДОзагрузить до заполнения первого экрана (макс. 2 захода).
//  • Увеличенный rootMargin (2000px) — триггерится даже без прокрутки.
//  • Не трогает вашу логику loadMore: просто вызывает её, когда «нужно ещё».
// Использование: <FeedAutoloader containerRef={listRef} onNeedMore={loadMore} isLoading={loading}/>
import React, { useEffect, useRef } from "react";

export default function FeedAutoloader({
  containerRef,          // ref на контейнер, внутри которого рендерятся карточки
  onNeedMore,            // () => Promise<void> | void — ваша функция подгрузки
  isLoading = false,     // флаг "сейчас грузим" (чтобы не дёргать лишний раз)
  firstScreenBurst = 2,  // максимум дополнительных подгрузок для заполнения первого экрана
}) {
  const sentinelRef = useRef(null);
  const ioRef = useRef(null);
  const moRef = useRef(null);
  const runningRef = useRef(false); // защита от повторов

  // Создаём sentinel в конце контейнера
  useEffect(() => {
    const wrap = containerRef?.current;
    if (!wrap) return;

    // создаём sentinel, если его нет
    let sentinel = sentinelRef.current;
    if (!sentinel) {
      sentinel = document.createElement("div");
      sentinel.style.width = "1px";
      sentinel.style.height = "1px";
      sentinel.style.opacity = "0";
      sentinel.dataset.autoload = "sentinel";
      wrap.appendChild(sentinel);
      sentinelRef.current = sentinel;
    }

    // IO с огромным rootMargin — сработает даже без скролла
    ioRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          triggerLoad();
        }
      },
      { root: null, rootMargin: "2000px 0px 2000px 0px", threshold: 0.001 }
    );
    ioRef.current.observe(sentinel);

    // MutationObserver: если высота контейнера изменилась — пробуем заполнить экран
    moRef.current = new MutationObserver(() => {
      maybeFillFirstScreen();
    });
    moRef.current.observe(wrap, { childList: true, subtree: true });

    // Первая попытка — сразу после рендера
    // (requestAnimationFrame, чтобы дождаться DOM-измерений)
    const id = requestAnimationFrame(() => {
      maybeFillFirstScreen();
    });

    // очистка
    return () => {
      cancelAnimationFrame(id);
      if (ioRef.current) ioRef.current.disconnect();
      if (moRef.current) moRef.current.disconnect();
      // sentinel остаётся в DOM — он безвреден и пригодится при повторном маунте
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  // Единообразный триггер подгрузки
  async function triggerLoad() {
    if (runningRef.current || isLoading) return;
    runningRef.current = true;
    try {
      const p = onNeedMore?.();
      if (p && typeof p.then === "function") {
        await p;
      }
    } catch (e) {
      // проглатываем — следующий observer дёрнет ещё раз
      // console.warn("FeedAutoloader load error:", e);
    } finally {
      runningRef.current = false;
    }
  }

  // Дозагружаем, пока контента не хватает на первый экран
  async function maybeFillFirstScreen() {
    const wrap = containerRef?.current;
    if (!wrap) return;

    let tries = 0;
    // ждём завершение текущей загрузки
    if (runningRef.current || isLoading) return;

    // запустим до двух подзагрузок максимум
    while (tries < firstScreenBurst) {
      const height = wrap.getBoundingClientRect().height;
      const needMore = height < window.innerHeight * 1.1;
      if (!needMore) break;
      // подгружаем ещё порцию
      // eslint-disable-next-line no-await-in-loop
      await triggerLoad();
      tries += 1;
    }
  }

  return null; // Ничего не рисуем — компонент чисто сервисный
}
