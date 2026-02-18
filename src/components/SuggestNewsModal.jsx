// Путь: frontend/src/components/SuggestNewsModal.jsx
// Назначение: Модальное окно "Предложить новость" с отправкой на бэкенд (FormData + файлы).
//
// ВАЖНО: Ничего из существующей логики не удаляем — только добавляем:
// ✅ Подсказки по лимитам (Фото до 10 МБ, Видео до 150 МБ, Архив до 150 МБ)
// ✅ Клиентская валидация размеров файлов (чтобы пользователю было понятно сразу)
// ✅ Поле "Архив" (zip/7z/rar), если материалы слишком большие
// ✅ Архив отправляем как "files" (и дополнительно "files[]") — совместимость с разными бэкендами
//
// Текущая логика сохранена:
// - reCAPTCHA v3 (recaptcha_token + совместимые поля)
// - honeypot
// - отправка suggestNewsApi(fd) с fallback на api.post(..., timeout)
// - автозакрытие и обработка ошибок 400

import React, { useState, useEffect, useRef, useCallback } from "react";
import api, { suggestNews as suggestNewsApi } from "../Api"; // default axios-инстанс + ваш экспорт suggestNews
import { getRecaptchaV3Token } from "../utils/recaptchaV3";
import styles from "./SuggestNewsModal.module.css";

// reCAPTCHA v3 site key (публичный) — берём из frontend/.env.production
const SITE_KEY = process.env.REACT_APP_RECAPTCHA_V3_SITE_KEY || "";

// ✅ Таймаут для загрузки файлов (фото/видео/архив)
const SUGGEST_UPLOAD_TIMEOUT_MS = 180000;

// ✅ Лимиты (в байтах). Должны соответствовать тому, что реально пропускает бэкенд.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 150 * 1024 * 1024; // 150 MB
const MAX_ARCHIVE_BYTES = 150 * 1024 * 1024; // 150 MB (рекомендуемый лимит)

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} КБ`;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} МБ`;
}

function isArchiveName(name = "") {
  const n = String(name).toLowerCase();
  return n.endsWith(".zip") || n.endsWith(".7z") || n.endsWith(".rar");
}

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
    archive_file: null, // ✅ НОВОЕ: архив (zip/7z/rar)
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

  const setFileError = (key, msg) => {
    setErrors((prev) => ({ ...prev, [key]: msg }));
  };

  const clearFileError = (key) => {
    setErrors((prev) => {
      if (!prev?.[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateFileSize = (file, maxBytes, errKey) => {
    if (!file) return true;
    const size = Number(file.size || 0);
    if (size > maxBytes) {
      setFileError(
        errKey,
        `Файл слишком большой: ${formatBytes(size)}. Максимум: ${formatBytes(maxBytes)}.`
      );
      return false;
    }
    clearFileError(errKey);
    return true;
  };

  const onFileChange = (key) => (e) => {
    const file = e.target.files?.[0] || null;

    // Если пользователь нажал "Отмена" — просто очищаем
    if (!file) {
      setForm((prev) => ({ ...prev, [key]: null }));
      clearFileError(key);
      return;
    }

    // ✅ Проверка размеров по типу поля
    if (key === "image_file") {
      if (!validateFileSize(file, MAX_IMAGE_BYTES, "image_file")) {
        // сбрасываем input
        e.target.value = "";
        setForm((prev) => ({ ...prev, image_file: null }));
        return;
      }
    }

    if (key === "video_file") {
      if (!validateFileSize(file, MAX_VIDEO_BYTES, "video_file")) {
        e.target.value = "";
        setForm((prev) => ({ ...prev, video_file: null }));
        return;
      }
    }

    if (key === "archive_file") {
      // небольшой контроль по расширению (без жёсткой блокировки)
      if (!isArchiveName(file.name)) {
        setFileError(
          "archive_file",
          "Архив лучше отправлять в формате .zip / .7z / .rar"
        );
      } else {
        clearFileError("archive_file");
      }
      if (!validateFileSize(file, MAX_ARCHIVE_BYTES, "archive_file")) {
        e.target.value = "";
        setForm((prev) => ({ ...prev, archive_file: null }));
        return;
      }
    }

    setForm((prev) => ({ ...prev, [key]: file }));
  };

  const buildFormData = async () => {
    const fd = new FormData();

    // Текстовые поля
    fd.append("first_name", form.first_name.trim());
    fd.append("last_name", form.last_name.trim());
    fd.append("email", form.email.trim());
    if (form.phone?.trim()) fd.append("phone", form.phone.trim());
    fd.append("title", form.title.trim());
    fd.append("message", form.message.trim());

    // Honeypot (если заполнен — просто отправим; на бэке отсеется)
    if (form.website) fd.append("website", form.website);

    // Файлы: кладём под несколькими ключами для совместимости с разными бэкендами
    // ✅ ВАЖНО: дополнительно кладём под "files" (и "files[]"), чтобы бэк мог брать request.FILES.getlist("files")
    if (form.image_file) {
      fd.append("image_file", form.image_file);
      fd.append("image", form.image_file);
      fd.append("photo", form.image_file);
      fd.append("files", form.image_file);
      fd.append("files[]", form.image_file);
    }

    if (form.video_file) {
      fd.append("video_file", form.video_file);
      fd.append("video", form.video_file);
      fd.append("files", form.video_file);
      fd.append("files[]", form.video_file);
    }

    // ✅ НОВОЕ: архив с материалами
    if (form.archive_file) {
      // отправляем как общий файл
      fd.append("files", form.archive_file);
      fd.append("files[]", form.archive_file);
      // и отдельно — чтобы на бэке было проще отличать при желании (не обязательно)
      fd.append("archive", form.archive_file);
    }

    // reCAPTCHA v3 токен (если ключ задан)
    let token = null;
    if (SITE_KEY) {
      token = await getRecaptchaV3Token("suggest_news");
    }

    if (token) {
      // Главное поле (под v3)
      fd.append("recaptcha_token", token);

      // Совместимость со старыми бэкендами/валидаторами
      fd.append("captcha", token);
      fd.append("recaptcha", token);
      fd.append("g-recaptcha-response", token);
    }

    return fd;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrors((prev) => {
      // не стираем файловые ошибки "на лету" — но общие уберём
      const next = { ...prev };
      delete next._common;
      return next;
    });
    setSuccess(false);

    const errs = {};
    if (!form.first_name.trim()) errs.first_name = "Укажите имя";
    if (!form.last_name.trim()) errs.last_name = "Укажите фамилию";
    if (!form.email.trim()) errs.email = "Укажите e-mail";
    if (!form.title.trim()) errs.title = "Укажите заголовок новости";
    if (!form.message.trim() || form.message.trim().length < 15)
      errs.message = "Опишите новость подробнее (минимум 15 символов)";

    // ✅ Дополнительная валидация размеров перед отправкой (на всякий случай)
    if (form.image_file && form.image_file.size > MAX_IMAGE_BYTES) {
      errs.image_file = `Фото слишком большое. Максимум ${formatBytes(MAX_IMAGE_BYTES)}.`;
    }
    if (form.video_file && form.video_file.size > MAX_VIDEO_BYTES) {
      errs.video_file = `Видео слишком большое. Максимум ${formatBytes(MAX_VIDEO_BYTES)}.`;
    }
    if (form.archive_file && form.archive_file.size > MAX_ARCHIVE_BYTES) {
      errs.archive_file = `Архив слишком большой. Максимум ${formatBytes(MAX_ARCHIVE_BYTES)}.`;
    }

    if (Object.keys(errs).length) {
      setErrors((prev) => ({ ...prev, ...errs }));
      return;
    }

    if (form.website) {
      // honeypot сработал — тихо закрываем без отправки
      setSuccess(true);
      setTimeout(() => handleClose(), 800);
      return;
    }

    setSending(true);

    try {
      const fd = await buildFormData();

      // 1) Пытаемся использовать ваш экспорт suggestNews (если он умеет FormData и увеличенный timeout)
      try {
        await suggestNewsApi(fd);
      } catch (inner) {
        // 2) Fallback: шлём напрямую через общий axios-инстанс на новый бэкенд
        // ✅ добавили timeout, чтобы большие файлы не обрывались
        await api.post("/news/suggest/", fd, { timeout: SUGGEST_UPLOAD_TIMEOUT_MS });
      }

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
        archive_file: null,
      });

      // Мягкое автозакрытие
      setTimeout(() => handleClose(), 2500);
    } catch (err) {
      console.error("Ошибка при отправке новости:", err);

      // Разбираем DRF-ошибки, если есть
      const data = err?.response?.data;
      if (err?.response?.status === 400 && data && typeof data === "object") {
        const fe = {};
        if (typeof data.detail === "string") fe._common = data.detail;

        [
          "first_name",
          "last_name",
          "email",
          "phone",
          "title",
          "message",
          "image_file",
          "video_file",
          "archive_file",
          "recaptcha_token",
          "captcha",
          "recaptcha",
          "g-recaptcha-response",
        ].forEach((k) => {
          if (Array.isArray(data[k])) fe[k] = data[k].join(" ");
          else if (typeof data[k] === "string") fe[k] = data[k];
        });

        setErrors(Object.keys(fe).length ? fe : { _common: "Проверьте поля формы." });
      } else if (err?.message) {
        setErrors({ _common: err.message });
      } else {
        setErrors({ _common: "Ошибка сети или сервера. Попробуйте позже." });
      }
      setSuccess(false);
    } finally {
      setSending(false);
    }
  };

  const selectedImageInfo = form.image_file
    ? `${form.image_file.name} (${formatBytes(form.image_file.size)})`
    : "";
  const selectedVideoInfo = form.video_file
    ? `${form.video_file.name} (${formatBytes(form.video_file.size)})`
    : "";
  const selectedArchiveInfo = form.archive_file
    ? `${form.archive_file.name} (${formatBytes(form.archive_file.size)})`
    : "";

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
          <button className={styles.close} onClick={handleClose} aria-label="Закрыть">
            ×
          </button>
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
              <label className={styles.label}>Фото</label>
              <input type="file" accept="image/*" onChange={onFileChange("image_file")} />
              {selectedImageInfo ? <small>Выбрано: {selectedImageInfo}</small> : null}
              <small>Максимум: 10 МБ. Форматы: JPG/PNG/WebP/GIF.</small>
              {errors.image_file && <div className={styles.fieldError}>{errors.image_file}</div>}
            </div>

            <div className={styles.row}>
              <label className={styles.label}>Видео</label>
              <input type="file" accept="video/*" onChange={onFileChange("video_file")} />
              {selectedVideoInfo ? <small>Выбрано: {selectedVideoInfo}</small> : null}
              <small>Максимум: 150 МБ. Рекомендуемый формат: MP4.</small>
              {errors.video_file && <div className={styles.fieldError}>{errors.video_file}</div>}
            </div>

            <div className={styles.row}>
              <label className={styles.label}>Архив с материалами (если файлы большие)</label>
              <input
                type="file"
                accept=".zip,.7z,.rar,application/zip,application/x-7z-compressed,application/x-rar-compressed"
                onChange={onFileChange("archive_file")}
              />
              {selectedArchiveInfo ? <small>Выбрано: {selectedArchiveInfo}</small> : null}
              <small>
                Если фото/видео больше лимита — можно упаковать в архив (ZIP/7z/RAR) и приложить архив.
                Рекомендуемый максимум архива: 150 МБ.
              </small>
              <small>
                Подсказка: архиватор обычно почти не уменьшает видео. Если файл всё равно большой — добавьте ссылку на облако в тексте.
              </small>
              {errors.archive_file && <div className={styles.fieldError}>{errors.archive_file}</div>}
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
