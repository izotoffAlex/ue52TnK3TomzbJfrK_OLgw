/* Путь: frontend/src/components/zen/ZenEditor.jsx
   Назначение: Обёртка EditorJS. Синглтон на страницу + жёсткая нормализация пустых блоков.
   Дополнено:
     ✅ Добавлен Image tool с uploader'ом через onUploadImage(file) -> { url }
     ✅ Совместимость по пропсам: initialValue / initialJson
*/

import React, { useEffect, useRef } from "react";
import EditorJS from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import Quote from "@editorjs/quote";
import Delimiter from "@editorjs/delimiter";
import Embed from "@editorjs/embed";
import Table from "@editorjs/table";
import ImageTool from "@editorjs/image";

import "./ZenEditor.css";

const ZEN_SINGLETON_FLAG = "__izotovlife__zen_editor_running__";

export default function ZenEditor({
  // ✅ совместимость: кто-то передаёт initialValue, кто-то initialJson
  initialValue = null,
  initialJson = null,

  onChange = () => {},

  // ✅ загрузка картинок (как в AuthorDashboard: uploadAuthorImage)
  // ожидаем: async (file) => ({ url: "https://..." })
  onUploadImage = null,

  holderId = "zen-editor-holder-singleton",
  autofocus = false,
}) {
  const ej = useRef(null);
  const onChangeRef = useRef(onChange);
  const onUploadRef = useRef(onUploadImage);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onUploadRef.current = onUploadImage;
  }, [onUploadImage]);

  const value = initialJson || initialValue;

  const prepared =
    value && Array.isArray(value.blocks) && value.blocks.length > 0 ? value : null;

  async function normalize(editor) {
    try {
      const data = await editor.save();
      const blocks = Array.isArray(data?.blocks) ? data.blocks : [];

      const isEmpty = (b) =>
        b?.type === "paragraph" &&
        (!b.data?.text ||
          b.data.text
            .replace(/<br\s*\/?>/gi, "")
            .replace(/&nbsp;/g, " ")
            .trim() === "");

      const nonEmpty = blocks.filter((b) => !isEmpty(b));
      const empty = blocks.filter(isEmpty);

      // Если контент пустой, должен остаться РОВНО ОДИН пустой параграф
      if (nonEmpty.length === 0 && empty.length !== 1) {
        await editor.clear();
        await editor.blocks.render([{ type: "paragraph", data: { text: "" } }]);
      }
    } catch {
      // игнорируем
    }
  }

  useEffect(() => {
    // СИНГЛТОН — второй инстанс не инициализируем
    if (window[ZEN_SINGLETON_FLAG]) {
      console.warn("ZenEditor: второй инстанс не инициализирован (синглтон).");
      return () => {};
    }
    window[ZEN_SINGLETON_FLAG] = true;

    let editor;

    const cfg = {
      holder: holderId,
      autofocus,
      minHeight: 0,
      placeholder: "Начните писать текст…",
      inlineToolbar: true,
      tools: {
        header: {
          class: Header,
          inlineToolbar: ["bold", "italic", "link"],
          config: { levels: [2, 3, 4], defaultLevel: 2 },
        },
        list: { class: List, inlineToolbar: true },
        quote: { class: Quote, inlineToolbar: true },
        delimiter: Delimiter,
        embed: {
          class: Embed,
          inlineToolbar: false,
          config: { services: { youtube: true, twitter: true, instagram: true } },
        },
        table: { class: Table, inlineToolbar: true },

        // ✅ Картинки (как в Дзене)
        image: {
          class: ImageTool,
          config: {
            uploader: {
              uploadByFile: async (file) => {
                const fn = onUploadRef.current;
                if (!fn) {
                  // EditorJS ожидает { success: 0 }
                  return { success: 0 };
                }
                try {
                  const r = await fn(file);
                  const url = r?.url || r?.data?.url || r?.file?.url || "";
                  if (!url) return { success: 0 };
                  return { success: 1, file: { url } };
                } catch {
                  return { success: 0 };
                }
              },
            },
          },
        },
      },
      onReady: async () => {
        ej.current = editor;
        // микрозадержка — даём EditorJS дорисовать дефолтный блок
        setTimeout(() => normalize(editor), 0);
      },
      onChange: async () => {
        try {
          const data = await editor.save();
          onChangeRef.current?.(data);
        } catch {
          // ignore
        }
      },
    };

    if (prepared) cfg.data = prepared;

    editor = new EditorJS(cfg);

    return () => {
      try {
        ej.current?.destroy?.();
      } finally {
        ej.current = null;
        window[ZEN_SINGLETON_FLAG] = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="zen-editor-root">
      <div id={holderId} className="zen-editor-holder" />
    </div>
  );
}
