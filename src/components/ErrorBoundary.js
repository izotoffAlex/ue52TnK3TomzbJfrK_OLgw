// Путь: frontend/src/components/ErrorBoundary.js
// Назначение: Перехватывает ошибки рендера React и показывает диагностическую карточку,
// чтобы вместо "белого экрана" была понятная причина.

import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Лог в консоль — чтобы было видно причину
    // eslint-disable-next-line no-console
    console.error("React render error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ maxWidth: 860, margin: "40px auto", padding: 16 }}>
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(20,20,25,.9)",
            color: "#fff",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial',
          }}
        >
          <h2 style={{ marginTop: 0 }}>Ошибка интерфейса (React)</h2>
          <p style={{ opacity: 0.9 }}>
            Вместо “белого экрана” показываем диагностику. Открой Console (F12) —
            там будет полный стек.
          </p>

          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              padding: 12,
              borderRadius: 8,
              background: "rgba(0,0,0,.35)",
              overflow: "auto",
            }}
          >
            {String(this.state.error || "")}
          </pre>
        </div>
      </div>
    );
  }
}
