import { useState } from "react";
import type { StoredPhoto } from "../types";
import { downloadDataUrl, downloadPhotosAsZip } from "../lib/files";

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MyCollection({
  photos,
  onRemove,
  onClear,
  onPreview,
  onNavigate,
}: {
  photos: StoredPhoto[];
  onRemove: (photoId: string) => void;
  onClear: () => void;
  onPreview: (photo: StoredPhoto) => void;
  onNavigate: (tab: "search" | "album") => void;
}) {
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  async function handleDownloadAllZip() {
    if (photos.length === 0 || downloadingZip) return;
    setDownloadingZip(true);
    setZipProgress(`Preparing ${photos.length} photo${photos.length === 1 ? "" : "s"}…`);

    try {
      await downloadPhotosAsZip(
        photos,
        `wedding-photos-collection-${photos.length}.zip`,
        (current, total) => {
          setZipProgress(`Adding photo ${current} of ${total} to archive…`);
        },
      );
      setZipProgress(null);
    } catch (err) {
      console.error("[ZIP Download Error]", err);
      alert("Failed to create ZIP download: " + ((err as Error).message || "Unknown error"));
      setZipProgress(null);
    } finally {
      setDownloadingZip(false);
    }
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>🎁 My Photo Collection</h2>
          <p>
            Saved photos across your searches. Download original full-resolution files individually or as a single ZIP.
          </p>
        </div>
        <span className="stat">
          <span className="num">{photos.length}</span> saved
        </span>
      </div>

      {photos.length === 0 ? (
        <div className="empty">
          <div className="big">🎁</div>
          <p style={{ fontWeight: 600, color: "var(--ink)", margin: "12px 0 6px" }}>
            Your collection is currently empty
          </p>
          <p style={{ maxWidth: 460, margin: "0 auto 20px" }}>
            Browse the <strong>Full Album</strong> or search with <strong>Guest Search</strong> (text, reference image, or Find Me face matching) and click <em>"+ Save to Collection"</em> to save your favorite moments here.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn small" onClick={() => onNavigate("search")}>
              🔎 Go to Guest Search
            </button>
            <button className="btn small ghost" onClick={() => onNavigate("album")}>
              💐 Browse Full Album
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Collection Action Bar */}
          <div className="collection-actions-bar">
            <div className="collection-summary">
              <strong>{photos.length}</strong> photo{photos.length === 1 ? "" : "s"} selected for batch download
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                className="btn sage"
                disabled={downloadingZip}
                onClick={() => void handleDownloadAllZip()}
              >
                {downloadingZip ? (
                  <>
                    <span className="spinner" style={{ marginRight: 6 }} />
                    {zipProgress || "Creating ZIP…"}
                  </>
                ) : (
                  `⬇ Download All as ZIP (${photos.length})`
                )}
              </button>
              <button
                className="btn ghost small"
                onClick={() => setConfirmClear(true)}
                disabled={downloadingZip}
              >
                Clear Collection
              </button>
            </div>
          </div>

          {zipProgress && (
            <p className="progress" style={{ margin: "10px 0 16px" }}>
              <span className="spinner" /> {zipProgress}
            </p>
          )}

          {/* Photos Grid */}
          <div className="grid">
            {photos.map((p) => (
              <div className="thumb collection-thumb" key={p.id}>
                <img src={p.dataUrl} alt={p.name} onClick={() => onPreview(p)} />
                <button
                  className="del"
                  title="Remove from Collection"
                  onClick={() => onRemove(p.id)}
                >
                  ×
                </button>
                <div className="thumb-bottom-actions">
                  <span className="meta" title={p.name}>
                    {p.name} {p.size ? `(${formatFileSize(p.size)})` : ""}
                  </span>
                  <div className="thumb-hover-btns">
                    <button
                      type="button"
                      className="thumb-quick-btn"
                      title="Preview Photo"
                      onClick={() => onPreview(p)}
                    >
                      👁
                    </button>
                    <button
                      type="button"
                      className="thumb-quick-btn download"
                      title="Download Photo"
                      onClick={() => downloadDataUrl(p.dataUrl, p.name)}
                    >
                      ⬇
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px" }}>
              Photos remain in your collection across searches and page reloads until removed or cleared.
            </p>
          </div>
        </>
      )}

      {/* Confirmation modal for clearing collection */}
      {confirmClear && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmClear(false)}
        >
          <div
            className="card"
            style={{ maxWidth: 420, width: "90%", margin: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 10px" }}>Clear Saved Collection?</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 18px", fontSize: 14 }}>
              Remove all {photos.length} photos from your saved collection? Your original album photos will not be affected.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn ghost small" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
              <button
                className="btn small"
                onClick={() => {
                  onClear();
                  setConfirmClear(false);
                }}
              >
                Yes, Clear Collection
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
