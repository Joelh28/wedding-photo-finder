import { useCallback, useEffect, useMemo, useState } from "react";
import type { PhotoAttributes, StoredPhoto } from "./types";
import * as db from "./lib/db";
import { getHealth } from "./lib/api";
import { PhotographerStudio } from "./components/PhotographerStudio";
import { GuestSearch } from "./components/GuestSearch";
import { FullAlbum } from "./components/FullAlbum";
import { MyCollection } from "./components/MyCollection";
import { Lightbox } from "./components/Lightbox";

type Tab = "studio" | "search" | "album" | "collection";

const CONSENT_KEY = "wpf-consent-dismissed";
const COLLECTION_STORAGE_KEY = "wedding_collection_ids";

export default function App() {
  const [tab, setTab] = useState<Tab>("studio");
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [preview, setPreview] = useState<StoredPhoto | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [consentDismissed, setConsentDismissed] = useState(
    () => localStorage.getItem(CONSENT_KEY) === "1",
  );

  // My Photo Collection State (persisted locally across refreshes)
  const [collectionIds, setCollectionIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(COLLECTION_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Fast O(1) set lookup for collection membership
  const collectionIdSet = useMemo(() => new Set(collectionIds), [collectionIds]);

  // Actual StoredPhoto objects currently in the collection
  const collectionPhotos = useMemo(() => {
    return photos.filter((p) => collectionIdSet.has(p.id));
  }, [photos, collectionIdSet]);

  // Load photos from IndexedDB on mount.
  useEffect(() => {
    void db.getAllPhotos().then(setPhotos);
  }, []);

  // Automatically prune photos from collection if they were deleted from the album
  useEffect(() => {
    if (collectionIds.length === 0) return;
    const currentAlbumPhotoIds = new Set(photos.map((p) => p.id));
    const validIds = collectionIds.filter((id) => currentAlbumPhotoIds.has(id));
    if (validIds.length !== collectionIds.length) {
      setCollectionIds(validIds);
      localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(validIds));
    }
  }, [photos, collectionIds]);

  // Probe whether the backend has AI configured (without ever seeing the key).
  useEffect(() => {
    getHealth()
      .then((h) => {
        setAiConfigured(h.aiConfigured);
        setModel(h.model);
      })
      .catch(() => setAiConfigured(false));
  }, []);

  const addPhotos = useCallback(async (incoming: StoredPhoto[]) => {
    await db.putPhotos(incoming);
    setPhotos(await db.getAllPhotos());
  }, []);

  const deletePhoto = useCallback(async (id: string) => {
    await db.deletePhoto(id);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    await db.clearAll();
    setPhotos([]);
    setCollectionIds([]);
    localStorage.removeItem(COLLECTION_STORAGE_KEY);
    setConfirmClear(false);
  }, []);

  const onAttributesComputed = useCallback(
    async (id: string, attributes: PhotoAttributes) => {
      await db.setAttributes(id, attributes);
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, attributes } : p)));
    },
    [],
  );

  const onFacesComputed = useCallback(
    async (id: string, faces: import("./types").DetectedFace[]) => {
      await db.setPhotoFaces(id, faces);
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, faces } : p)));
    },
    [],
  );

  const onClearFaces = useCallback(async () => {
    await db.clearAllFaceData();
    setPhotos((prev) =>
      prev.map((p) => {
        const { faces: _f, ...rest } = p;
        return rest as StoredPhoto;
      }),
    );
  }, []);

  // Collection Actions
  const toggleCollection = useCallback((photo: StoredPhoto) => {
    setCollectionIds((prev) => {
      const exists = prev.includes(photo.id);
      const next = exists ? prev.filter((id) => id !== photo.id) : [...prev, photo.id];
      localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeFromCollection = useCallback((photoId: string) => {
    setCollectionIds((prev) => {
      const next = prev.filter((id) => id !== photoId);
      localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearCollection = useCallback(() => {
    setCollectionIds([]);
    localStorage.removeItem(COLLECTION_STORAGE_KEY);
  }, []);

  return (
    <div className="app">
      <header className="masthead">
        <div className="script">A I&nbsp;·&nbsp;C A P S T O N E&nbsp;·&nbsp;P R O J E C T</div>
        <h1>Wedding Photo Finder</h1>
        <p>Find the moments that matter — by visual attributes or optional on-device face matching.</p>
      </header>

      {/* Ethics / consent banner — informs the user before any AI call */}
      {!consentDismissed && (
        <div className="banner info">
          <span>🔒</span>
          <div>
            <strong>How this works &amp; your privacy</strong>
            Photos are stored only in <em>this browser</em> (no account, no database). Visual attribute
            search uses server proxy calls; facial matching runs 100% on-device in your browser.
          </div>
          <button
            className="dismiss"
            aria-label="Dismiss"
            onClick={() => {
              localStorage.setItem(CONSENT_KEY, "1");
              setConsentDismissed(true);
            }}
          >
            ×
          </button>
        </div>
      )}

      {aiConfigured === false && (
        <div className="banner warn">
          <span>⚠️</span>
          <div>
            <strong>AI provider not configured</strong>
            Upload and album browsing work now. To enable AI search, ensure <code>GEMINI_API_KEY</code> is available in the environment (or optionally <code>AI_API_KEY</code> for an OpenAI-compatible endpoint). No results are ever fabricated.
          </div>
        </div>
      )}
      {aiConfigured === true && (
        <div className="banner ok">
          <span>✓</span>
          <div>
            AI search is ready{model ? ` using ${model}` : ""}. Photos are sent to the server proxy
            only when you search.
          </div>
        </div>
      )}

      <nav className="tabs">
        <button className={`tab${tab === "studio" ? " active" : ""}`} onClick={() => setTab("studio")}>
          📸 Photographer Studio
        </button>
        <button className={`tab${tab === "search" ? " active" : ""}`} onClick={() => setTab("search")}>
          🔎 Guest Search
        </button>
        <button className={`tab${tab === "album" ? " active" : ""}`} onClick={() => setTab("album")}>
          💐 Full Album
        </button>
        <button className={`tab${tab === "collection" ? " active" : ""}`} onClick={() => setTab("collection")}>
          🎁 My Collection {collectionPhotos.length > 0 && <span className="tab-badge">{collectionPhotos.length}</span>}
        </button>
      </nav>

      {tab === "studio" && (
        <PhotographerStudio
          photos={photos}
          collectionIds={collectionIdSet}
          onToggleCollection={toggleCollection}
          onAdd={addPhotos}
          onDelete={deletePhoto}
          onClear={() => setConfirmClear(true)}
          onPreview={setPreview}
        />
      )}
      {tab === "search" && (
        <GuestSearch
          photos={photos}
          aiConfigured={Boolean(aiConfigured)}
          collectionIds={collectionIdSet}
          onToggleCollection={toggleCollection}
          onAttributesComputed={onAttributesComputed}
          onFacesComputed={onFacesComputed}
          onClearFaces={onClearFaces}
          onPreview={setPreview}
        />
      )}
      {tab === "album" && (
        <FullAlbum
          photos={photos}
          collectionIds={collectionIdSet}
          onToggleCollection={toggleCollection}
          onPreview={setPreview}
        />
      )}
      {tab === "collection" && (
        <MyCollection
          photos={collectionPhotos}
          onRemove={removeFromCollection}
          onClear={clearCollection}
          onPreview={setPreview}
          onNavigate={(targetTab) => setTab(targetTab)}
        />
      )}

      {confirmClear && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setConfirmClear(false)}>
          <div className="card" style={{ maxWidth: 420, width: "90%", margin: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 10px" }}>Clear Entire Album?</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 18px", fontSize: 14 }}>
              Remove all photos from this browser? This action cannot be undone and will also reset your collection.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn ghost small" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
              <button className="btn small" onClick={() => void clearAll()}>
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      <Lightbox
        photo={preview}
        isInCollection={preview ? collectionIdSet.has(preview.id) : false}
        onToggleCollection={toggleCollection}
        onClose={() => setPreview(null)}
      />

      <p className="footer-note">
        Visual-attribute search (Gemini) · Optional on-device facial matching · My Photo Collection · Photos stay in your browser
        <br />
        University AI capstone prototype — use synthetic or consented images only.
      </p>
    </div>
  );
}
