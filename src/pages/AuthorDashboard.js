// frontend/src/pages/AuthorDashboard.js
// Назначение: Кабинет автора. Создание и редактирование статей с возможностью вставки фото прямо в текст (как в Дзене).
// Путь: frontend/src/pages/AuthorDashboard.js

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  fetchMyArticles,
  createArticle,
  updateArticle,
  submitArticle,
  withdrawArticle,
  fetchCategories,
} from "../Api";
import ReactQuill from "react-quill";
import ReactSelect from "react-select";
import "react-quill/dist/quill.snow.css";
import api from "../Api"; // ⚡ для загрузки картинок

export default function AuthorDashboard() {
  const [articles, setArticles] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // поля формы
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categories, setCategories] = useState([]);
  const [coverImage, setCoverImage] = useState(null);

  const quillRef = useRef(null); // ✅ доступ к Quill

  // ===== Загрузка статей =====
  const loadArticles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMyArticles();
      const items = Array.isArray(data) ? data : data.results || [];
      setArticles(items);
    } catch (err) {
      setError("Ошибка загрузки статей");
    } finally {
      setLoading(false);
    }
  }, []);

  // ===== Загрузка категорий =====
  const loadCategories = useCallback(async () => {
    try {
      const data = await fetchCategories();
      setCategoriesList(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error("Ошибка категорий", err);
    }
  }, []);

  useEffect(() => {
    loadArticles();
    loadCategories();
  }, [loadArticles, loadCategories]);

  // ===== Загрузка фото в Quill =====
  const imageHandler = () => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files[0];
      if (file) {
        const formData = new FormData();
        formData.append("image", file);

        try {
          const res = await api.post("/news/upload-image/", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });

          const url = res.data.url;
          const editor = quillRef.current.getEditor();
          const range = editor.getSelection();
          editor.insertEmbed(range.index, "image", url);
        } catch (err) {
          console.error("Ошибка загрузки фото", err);
          setError("Не удалось загрузить фото");
        }
      }
    };
  };

  // ===== Конфигурация редактора =====
  const modules = {
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "image"],
        ["clean"],
      ],
      handlers: {
        image: imageHandler, // ✅ вставка фото
      },
    },
  };

  // ===== Сохранение статьи =====
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title,
        content,
        categories,
        cover_image: coverImage,
      };

      let savedArticle;
      if (editingId) {
        savedArticle = await updateArticle(editingId, payload);
        setArticles((prev) =>
          prev.map((a) => (a.id === editingId ? savedArticle : a))
        );
      } else {
        savedArticle = await createArticle(payload);
        setArticles((prev) => [savedArticle, ...prev]);
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setError("Ошибка при сохранении статьи");
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setContent("");
    setCategories([]);
    setCoverImage(null);
  };

  const startEdit = (article) => {
    setEditingId(article.id);
    setTitle(article.title);
    setContent(article.content);
    setCategories(article.categories.map((c) => c.id));
    setCoverImage(null);
    setShowForm(true);
  };

  // ===== Отправка на модерацию =====
  const handleSubmitArticle = async (id) => {
    try {
      const res = await submitArticle(id);
      setArticles((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: res.status } : a))
      );
    } catch {
      setError("Не удалось отправить статью на модерацию");
    }
  };

  // ===== Отзыв статьи =====
  const handleWithdrawArticle = async (id) => {
    try {
      const res = await withdrawArticle(id);
      setArticles((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: res.status } : a))
      );
    } catch {
      setError("Не удалось отозвать статью");
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Кабинет автора</h1>

      {error && <div className="text-red-400 mb-4">{error}</div>}

      <button
        onClick={() => (showForm ? resetForm() : setShowForm(true))}
        className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
      >
        {showForm ? "Отмена" : "Создать статью"}
      </button>

      {showForm && (
        <form onSubmit={handleSave} className="space-y-3 mb-6">
          <input
            type="text"
            placeholder="Заголовок"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 rounded bg-[var(--bg-card)] border border-gray-600"
            required
          />

          {/* ✅ редактор с загрузкой фото */}
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={content}
            onChange={setContent}
            className="bg-white text-black rounded h-96 mb-4"
            placeholder="Введите текст статьи..."
            modules={modules}
          />

          <label className="block text-sm text-gray-300 mb-1">
            Новостные категории:
          </label>
          <ReactSelect
            isMulti
            options={categoriesList.map((cat) => ({
              value: cat.id,
              label: cat.name,
            }))}
            value={categoriesList
              .filter((cat) => categories.includes(cat.id))
              .map((cat) => ({ value: cat.id, label: cat.name }))}
            onChange={(selected) =>
              setCategories(selected.map((s) => s.value))
            }
            className="text-black"
          />

          <label className="block text-sm text-gray-300">
            Обложка статьи:
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverImage(e.target.files[0])}
              className="w-full p-2 rounded bg-[var(--bg-card)] border border-gray-600"
            />
          </label>

          <button
            type="submit"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
          >
            {editingId ? "Сохранить изменения" : "Сохранить"}
          </button>
        </form>
      )}

      {loading ? (
        <div>Загрузка...</div>
      ) : articles.length === 0 ? (
        <div>У вас пока нет статей.</div>
      ) : (
        <ul className="space-y-3">
          {articles.map((a) => (
            <li
              key={a.id}
              className="p-3 border border-gray-700 rounded bg-[var(--bg-card)]"
            >
              <div className="flex justify-between">
                <div>
                  <h3 className="font-bold">{a.title}</h3>
                  <p className="text-sm text-gray-400">Статус: {a.status}</p>
                </div>
                <div className="flex gap-2">
                  {a.status === "Черновик" && (
                    <>
                      <button
                        onClick={() => startEdit(a)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleSubmitArticle(a.id)}
                        className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded"
                      >
                        Отправить
                      </button>
                    </>
                  )}
                  {a.status === "На модерации" && (
                    <button
                      onClick={() => handleWithdrawArticle(a.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded"
                    >
                      Отозвать
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
