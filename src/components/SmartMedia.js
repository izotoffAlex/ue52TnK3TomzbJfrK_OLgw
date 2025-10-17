// Путь: frontend/src/components/SmartMedia.js
// Назначение: Универсальный компонент отображения изображений с fallback и srcSet для Retina

import React from "react";

const SmartMedia = ({ src, alt, title, className = "" }) => {
  if (!src) return null;

  return (
    <picture className={className} style={{ display: "block", marginBottom: "16px" }}>
      <img
        src={src}
        alt={alt || ""}
        title={title || alt || ""}
        style={{
          width: "100%",
          height: "auto",
          borderRadius: "12px",
          objectFit: "cover",
          display: "block",
          imageRendering: "auto",
        }}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
};

export default SmartMedia;
