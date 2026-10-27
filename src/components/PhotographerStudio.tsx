import { useRef, useState } from "react";
import type { StoredPhoto } from "../types";
import { filesToStoredPhotos } from "../lib/files";

export function PhotographerStudio({
  photos,
  collectionIds,
  onToggleCollection,
  onAdd,
  onDelete,
  onClear,
  onPreview,
}: {
  photos: StoredPhoto[];
  collectionIds?: Set<string>;
  onToggleCollection?: (photo: StoredPhoto) => void;
  onAdd: (photos: StoredPhoto[]) => Promise<void>;
  onDelete: (id: string) => void;
  onClear: () => void;
  onPreview: (photo: StoredPhoto) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastAdded, setLastAdded] = useState<number | null>(null);

  async function handleFiles(files: FileList | File[]) {
    setBusy(true);
    try {
      const stored = await filesToStoredPhotos(files);
      await onAdd(stored);
      setLastAdded(stored.length);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>📸 Photographer Studio</h2>
          <p>Bulk-upload the wedding album. Photos are stored only in this browser.</p>
        </div>
        <span className="stat">
          <span className="num">{photos.length}</span> photo{photos.length === 1 ? "" : "s"} stored
        </span>
      </div>

      <div
        className={`dropzone${dragging ? " drag" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="big">⬆️</div>
        <strong>Drop photos here, or click to select multiple</strong>
        <p>JPG, PNG, WebP, GIF — upload the whole album at once</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {busy && (
        <p className="progress">
          <span className="spinner" /> Reading and storing photos…
        </p>
      )}
      {!busy && lastAdded !== null && (
        <p className="progress">
          ✓ Successfully uploaded <strong>{lastAdded}</strong> photo
          {lastAdded === 1 ? "" : "s"} in the last batch.
        </p>
      )}

      {photos.length > 0 && (
        <>
          <div className="grid">
            {photos.map((p) => {
              const isSaved = collectionIds?.has(p.id) ?? false;
              return (
                <div className="thumb" key={p.id}>
                  <img src={p.dataUrl} alt={p.name} onClick={() => onPreview(p)} />
                  <span className={`badge${p.attributes || p.faces ? "" : " pending"}`}>
                    {p.attributes ? "AI ✓" : "pending"}
                    {p.faces && p.faces.length > 0 ? ` · 👤 ${p.faces.length}` : ""}
                  </span>
                  {onToggleCollection && (
                    <button
                      type="button"
                      className={`thumb-collection-btn${isSaved ? " active" : ""}`}
                      title={isSaved ? "Remove from Collection" : "Save to Collection"}
                      style={{ left: "auto", right: 36 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleCollection(p);
                      }}
                    >
                      {isSaved ? "✓" : "🎁"}
                    </button>
                  )}
                  <button className="del" title="Remove" onClick={() => onDelete(p.id)}>
                    ×
                  </button>
                  <div className="meta">{p.name}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="btn ghost small" onClick={onClear}>
              Clear entire album
            </button>
          </div>
        </>
      )}
    </section>
  );
}
