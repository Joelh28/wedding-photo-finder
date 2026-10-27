import { useEffect } from "react";
import type { StoredPhoto } from "../types";
import { downloadDataUrl } from "../lib/files";

export function Lightbox({
  photo,
  isInCollection,
  onToggleCollection,
  onClose,
}: {
  photo: StoredPhoto | null;
  isInCollection?: boolean;
  onToggleCollection?: (photo: StoredPhoto) => void;
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
        {onToggleCollection && (
          <button
            type="button"
            className={`btn ${isInCollection ? "gold" : "ghost"}`}
            style={{ color: "#fff", borderColor: isInCollection ? "var(--gold)" : "rgba(255,255,255,0.5)" }}
            onClick={() => onToggleCollection(photo)}
          >
            {isInCollection ? "✓ In Collection" : "🎁 Save to Collection"}
          </button>
        )}
        <button className="btn sage" onClick={() => downloadDataUrl(photo.dataUrl, photo.name)}>
          ⬇ Download Original
        </button>
      </div>
    </div>
  );
}
