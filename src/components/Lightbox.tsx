import { useEffect } from "react";
import type { StoredPhoto } from "../types";
import { downloadDataUrl } from "../lib/files";

export function Lightbox({
  photo,
  onClose,
}: {
  photo: StoredPhoto | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!photo) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photo, onClose]);

  if (!photo) return null;

  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <button className="close" aria-label="Close preview" onClick={onClose}>
        ×
      </button>
      <img src={photo.dataUrl} alt={photo.name} onClick={(e) => e.stopPropagation()} />
      <div className="lb-actions" onClick={(e) => e.stopPropagation()}>
        <button className="btn sage" onClick={() => downloadDataUrl(photo.dataUrl, photo.name)}>
          ⬇ Download
        </button>
      </div>
    </div>
  );
}
