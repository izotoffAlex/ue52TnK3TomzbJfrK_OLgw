// Путь: frontend/src/components/NewsMedia.jsx
// Назначение: Универсальный компонент для отображения медиа-контента новости
// Поддерживает: видео (video_file), картинку (image_file), fallback на image
// Используется как в карточках ленты, так и на детальной странице

import React from "react";

const NewsMedia = ({ news, type = "card" }) => {
  const imageUrl = news.image_file || news.image || null;
  const videoUrl = news.video_file || null;

  return (
    <div className={`news-media news-media-${type}`}>
      {videoUrl ? (
        <video controls width="100%">
          <source src={videoUrl} type="video/mp4" />
          Ваш браузер не поддерживает видео.
        </video>
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={news.title}
          title={news.title}
          className={`news-media-image news-media-image-${type}`}
        />
      ) : null}
    </div>
  );
};

export default NewsMedia;
