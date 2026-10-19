import type { StoredPhoto } from "../types";
import { downloadDataUrl } from "../lib/files";

export function FullAlbum({
  photos,
  onPreview,
}: {
  photos: StoredPhoto[];
  onPreview: (photo: StoredPhoto) => void;
}) {
  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>💐 Full Album</h2>
          <p>Browse every photo currently stored in this browser.</p>
        </div>
        <span className="stat">
          <span className="num">{photos.length}</span> total
        </span>
      </div>

      {photos.length === 0 ? (
        <div className="empty">
          <div className="big">🖼️</div>
          <p>No photos yet. Add some in the Photographer Studio.</p>
        </div>
      ) : (
        <div className="grid">
          {photos.map((p) => (
            <div className="thumb" key={p.id}>
              <img src={p.dataUrl} alt={p.name} onClick={() => onPreview(p)} />
              <button
                className="del"
                title="Download"
                style={{ background: "rgba(138,154,133,.9)" }}
                onClick={() => downloadDataUrl(p.dataUrl, p.name)}
              >
                ⬇
              </button>
              <div className="meta">{p.name}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
