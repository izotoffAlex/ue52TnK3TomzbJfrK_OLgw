// Путь: frontend/src/components/IncomingNewsTray.js
// Назначение: Трей "Входящие новости" + режим "subscribe" (форма подписки).
//
// FIX (2026-01-30 UI):
// ✅ Трей больше НЕ закрывается от клика по любой части формы/оверлея.
//    Закрытие только по крестику (и по Esc — это не мешает, но если хочешь убрать Esc — скажи).
// ✅ Исправлена ссылка на политику: /pages/politika-konfidencialnosti
// ✅ Ничего лишнего не удаляем — правка точечная.

import React, { useEffect, useMemo, useState } from "react";
import styles from "./IncomingNewsTray.module.css";

export default function IncomingNewsTray({
  open,
  mode = "incoming", // "incoming" | "subscribe"
  items = [],
  title = "Свежие новости",
  onClose,
  onSubmitSubscribe, // async (email) => {ok, email_sent, already_registered, message} ИЛИ boolean
  policyHref,
}) {
  const isOpen = !!open;

  // FIX: нормализуем ссылку на политику конфиденциальности
  const normalizedPolicyHref = useMemo(() => {
    const v = (policyHref || "").trim();
    if (!v) return "/pages/politika-konfidencialnosti";
    // если передали старый путь без /pages — поправим
    if (v === "/politika-konfidencialnosti" || v === "/politika-konfidencialnosti/") {
      return "/pages/politika-konfidencialnosti";
    }
    // абсолютные ссылки оставляем как есть
    if (v.startsWith("http://") || v.startsWith("https://")) return v;
    // относительные — оставляем
    return v;
  }, [policyHref]);

  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusOk, setStatusOk] = useState("");
  const [statusErr, setStatusErr] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    // FIX 2026-01-30: закрываем по Esc (если хочешь — уберём, но это удобно)
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    // сброс статусов при открытии
    setStatusOk("");
    setStatusErr("");
  }, [isOpen]);

  const isSubscribe = mode === "subscribe";

  const handleClose = () => {
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusOk("");
    setStatusErr("");

    const v = (email || "").trim();
    if (!v) {
      setStatusErr("Введите e-mail");
      return;
    }
    if (!agree) {
      setStatusErr("Нужно согласие с политикой конфиденциальности");
      return;
    }

    setBusy(true);
    try {
      const res = await onSubmitSubscribe?.(v);

      // поддерживаем и boolean, и объект
      if (res === true) {
        setStatusOk("На почту отправлено письмо подтверждения. Проверьте ящик.");
      } else if (res === false || res == null) {
        setStatusErr("Не удалось выполнить подписку. Попробуйте позже.");
      } else {
        const already = !!res.already_registered;
        const ok = !!res.ok;
        const msg = (res.message || "").trim();

        if (ok && already) {
          setStatusOk(msg || "Данный почтовый адрес уже зарегистрирован в базе.");
        } else if (ok) {
          setStatusOk(msg || "На почту отправлено письмо подтверждения. Проверьте ящик.");
        } else {
          setStatusErr(msg || "Не удалось выполнить подписку. Попробуйте позже.");
        }
      }
    } catch (err) {
      setStatusErr("Ошибка подписки. Попробуйте позже.");
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`${styles.overlay} ${isSubscribe ? styles.overlayCenter : ""}`}
      role="dialog"
      aria-modal="true"
    >
      {/* FIX 2026-01-30: НЕ закрываем трэй по клику в любом месте.
          Закрытие только по крестику (и по Esc). */}

      <div className={styles.sheet}>
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>

          {/* ✅ Закрытие только по крестику */}
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Закрыть"
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        {!isSubscribe ? (
          <div className={styles.list}>
            {items && items.length ? (
              items.map((it, idx) => (
                <a
                  key={it?.href || idx}
                  href={it?.href || "#"}
                  className={styles.rowLink}
                >
                  {it?.title || "—"}
                </a>
              ))
            ) : (
              <div className={styles.fallbackRow}>Пока нет новостей</div>
            )}
          </div>
        ) : (
          <div className={styles.subscribeWrap}>
            <form className={styles.subscribeForm} onSubmit={handleSubmit}>
              <label className={styles.label}>
                E-mail
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>

              <div className={styles.checkboxRow}>
                <input
                  className={styles.checkbox}
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  id="newsletterAgree"
                />
                <label className={styles.checkboxText} htmlFor="newsletterAgree">
                  Я согласен с{" "}
                  <a className={styles.policyLink} href={normalizedPolicyHref} target="_blank" rel="noreferrer">
                    политикой конфиденциальности
                  </a>
                </label>
              </div>

              <button className={styles.subscribeBtn} type="submit" disabled={busy}>
                {busy ? "Подписываем..." : "Подписаться"}
              </button>

              {statusOk ? <div className={styles.statusOk}>{statusOk}</div> : null}
              {statusErr ? <div className={styles.statusErr}>{statusErr}</div> : null}

              <div className={styles.note}>
                После подписки мы отправим письмо для подтверждения e-mail.
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
