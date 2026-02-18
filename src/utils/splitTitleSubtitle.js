// Путь: frontend/src/utils/splitTitleSubtitle.js
// Назначение: Разбивает строку заголовка из RSS на (title, subtitle).
// Логика:
//   ✅ поддержка переносов строк \n/\r\n
//   ✅ поддержка <br> / <br/> в строке
//   ✅ если подзаголовка нет — subtitle = ""
// Примечание: Ничего не меняем в БД, только корректно отображаем на фронте.

export function splitTitleSubtitle(rawTitle) {
  const input = (rawTitle ?? "").toString();

  // Иногда источники присылают переносы как <br>
  const withNewlines = input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r/g, "")
    .trim();

  if (!withNewlines) return { title: "", subtitle: "" };

  // Разрезаем по реальным переносам строк
  const parts = withNewlines
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      title: parts[0],
      // Подзаголовок может быть в несколько строк — склеим в одну “человеческую”
      subtitle: parts.slice(1).join(" "),
    };
  }

  // Если переносов нет — возвращаем как есть (нормализуем пробелы)
  return {
    title: withNewlines.replace(/\s+/g, " ").trim(),
    subtitle: "",
  };
}
