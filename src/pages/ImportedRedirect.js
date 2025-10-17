// frontend/src/pages/ImportedRedirect.js
// Назначение: редирект со старого URL /news/imported/:id на новый /news/i/:id

import { useParams, Navigate } from "react-router-dom";

export default function ImportedRedirect() {
  const { id } = useParams();
  return <Navigate to={`/news/i/${id}`} replace />;
}
