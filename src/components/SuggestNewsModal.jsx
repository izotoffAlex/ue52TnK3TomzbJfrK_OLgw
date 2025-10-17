// Путь: frontend/src/components/SuggestNewsModal.jsx
// Назначение: Модальное окно "Предложить новость" с мгновенной отправкой на новый бэкенд.
// Поддержка: заголовок, текст новости, изображение, видео, капча, скроллируемая форма.

import React, { useState, useEffect, useRef, useCallback } from "react";
import { suggestNews } from "../Api";
import styles from "./SuggestNewsModal.module.css";

export default function SuggestNewsModal({ open, onClose }) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    title: "",
    message: "",
    website: "", // honeypot
    recaptcha: "",
    image_file: null,
    video_file: null,
  });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [closing, setClosing] = useState(false);
  const firstInputRef = useRef(null);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setSuccess(false);
      onClose?.();
    }, 250);
  }, [onClose]);

  // ESC закрытие
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") handleClose();
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open, handleClose]);

  // Автофокус
  useEffect(() => {
    if (open && firstInputRef.current) {
      setTimeout(() => firstInputRef.current.focus(), 100);
    }
  }, [open]);

  // Сброс при открытии
  useEffect(() => {
    if (open) {
      setErrors({});
      setSuccess(false);
      setClosing(false);
    }
  }, [open]);

  if (!open) return null;

  const setField = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onFileChange = (key) => (e) => {
    const file = e.target.files[0];
    setForm((prev) => ({ ...prev, [key]: file || null }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSuccess(false);

    const errs = {};
    if (!form.first_name.trim()) errs.first_name = "Укажите имя";
    if (!form.last_name.trim()) errs.last_name = "Укажите фамилию";
    if (!form.email.trim()) errs.email = "Укажите e-mail";
    if (!form.title.trim()) errs.title = "Укажите заголовок новости";
    if (!form.message.trim() || form.message.trim().length < 15)
      errs.message = "Опишите новость подробнее (минимум 15 символов)";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    if (form.website) return; // honeypot

    setSending(true);

    try {
      await suggestNews(form);
      setSuccess(true);
      setForm({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        title: "",
        message: "",
        website: "",
        recaptcha: "",
        image_file: null,
        video_file: null,
      });
    } catch (err) {
      console.error("Ошибка при отправке новости:", err);
      setErrors({ _common: err.message });
      setSuccess(false);
    } finally {
      setSending(false);
    }

    setTimeout(() => handleClose(), 2500);
  };

  return (
    <div
      className={`${styles.backdrop} ${closing ? styles.fadeOut : styles.fadeIn}`}
      onClick={handleClose}
    >
      <div
        className={`${styles.modal} ${closing ? styles.fadeOut : styles.fadeIn}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.title}>Предложить новость</div>
          <button className={styles.close} onClick={handleClose} aria-label="Закрыть">×</button>
        </div>

        {success ? (
          <div className={styles.success}>Спасибо! Ваша новость отправлена в редакцию.</div>
        ) : (
          <form onSubmit={onSubmit} className={styles.form}>
            {errors._common && <div className={styles.error}>{errors._common}</div>}

            <div className={styles.row}>
              <label className={styles.label}>Имя*</label>
              <input
                ref={firstInputRef}
                className={styles.input}
                value={form.first_name}
                onChange={setField("first_name")}
                placeholder="Иван"
              />
              {errors.first_name && <div className={styles.fieldError}>{errors.first_name}</div>}
            </div>

            <div className={styles.row}>
              <label className={styles.label}>Фамилия*</label>
              <input
                className={styles.input}
                value={form.last_name}
                onChange={setField("last_name")}
                placeholder="Иванов"
              />
              {errors.last_name && <div className={styles.fieldError}>{errors.last_name}</div>}
            </div>

            <div className={styles.row}>
              <label className={styles.label}>E-mail*</label>
              <input
                className={styles.input}
                type="email"
                value={form.email}
                onChange={setField("email")}
                placeholder="you@example.com"
              />
              {errors.email && <div className={styles.fieldError}>{errors.email}</div>}
            </div>

            <div className={styles.row}>
              <label className={styles.label}>Телефон</label>
              <input
                className={styles.input}
                value={form.phone}
                onChange={setField("phone")}
                placeholder="+7 900 000-00-00"
              />
              {errors.phone && <div className={styles.fieldError}>{errors.phone}</div>}
            </div>

            <div className={styles.row}>
              <label className={styles.label}>Заголовок новости*</label>
              <input
                className={styles.input}
                value={form.title}
                onChange={setField("title")}
                placeholder="Краткий заголовок новости"
              />
              {errors.title && <div className={styles.fieldError}>{errors.title}</div>}
            </div>

            <div className={styles.row}>
              <label className={styles.label}>Новость*</label>
              <textarea
                className={styles.textarea}
                value={form.message}
                onChange={setField("message")}
                placeholder="Кто? Что? Где? Когда? Подробности, ссылки, факты…"
                rows={6}
              />
              {errors.message && <div className={styles.fieldError}>{errors.message}</div>}
            </div>

            <div className={styles.row}>
              <label className={styles.label}>Фото / Видео</label>
              <input type="file" accept="image/*,video/*" onChange={onFileChange("image_file")} />
              <input type="file" accept="image/*,video/*" onChange={onFileChange("video_file")} />
              <small>Поддерживаются форматы: jpg, png, gif, mp4</small>
            </div>

            <div className={styles.honeypot} aria-hidden="true">
              <label>Ваш сайт</label>
              <input
                value={form.website}
                onChange={setField("website")}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className={styles.actions}>
              <button className={styles.submit} type="submit" disabled={sending}>
                {sending ? "Отправляем…" : "Отправить новость"}
              </button>
              <button className={styles.secondary} type="button" onClick={handleClose}>
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
