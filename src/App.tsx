import { useCallback, useEffect, useState } from "react";
import type { PhotoAttributes, StoredPhoto } from "./types";
import * as db from "./lib/db";
import { getHealth } from "./lib/api";
import { PhotographerStudio } from "./components/PhotographerStudio";
import { GuestSearch } from "./components/GuestSearch";
import { FullAlbum } from "./components/FullAlbum";
import { Lightbox } from "./components/Lightbox";

type Tab = "studio" | "search" | "album";

const CONSENT_KEY = "wpf-consent-dismissed";

export default function App() {
  const [tab, setTab] = useState<Tab>("studio");
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [preview, setPreview] = useState<StoredPhoto | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [consentDismissed, setConsentDismissed] = useState(
    () => localStorage.getItem(CONSENT_KEY) === "1",
  );

  // Load photos from IndexedDB on mount.
  useEffect(() => {
    void db.getAllPhotos().then(setPhotos);
  }, []);

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
    setPhotos(await db.getAllPhotos());
  }, []);

  const [confirmClear, setConfirmClear] = useState(false);

  const clearAll = useCallback(async () => {
    await db.clearAll();
    setPhotos([]);
    setConfirmClear(false);
  }, []);

  const onAttributesComputed = useCallback(
    async (id: string, attributes: PhotoAttributes) => {
      await db.setAttributes(id, attributes);
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, attributes } : p)));
    },
    [],
  );

  return (
    <div className="app">
      <header className="masthead">
        <div className="script">A I&nbsp;·&nbsp;C A P S T O N E&nbsp;·&nbsp;P R O J E C T</div>
        <h1>Wedding Photo Finder</h1>
        <p>Find the moments that matter — by visual attributes, never by face.</p>
      </header>

      {/* Ethics / consent banner — informs the user before any AI call */}
      {!consentDismissed && (
        <div className="banner info">
          <span>🔒</span>
          <div>
            <strong>How this works &amp; your privacy</strong>
            Photos are stored only in <em>this browser</em> (no account, no database). When you
            run a search, selected photos are sent to <em>our own server proxy</em>, which forwards
            them to the configured AI provider
            {model ? ` (${model})` : ""} to describe <em>observable attributes only</em> — clothing,
            colors, objects, scenery. This tool does <strong>not</strong> do facial recognition or
            identify people. Please upload only synthetic or consented photos.
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
            Upload and album browsing work now. To enable AI search, configure an API key (e.g. <code>GEMINI_API_KEY</code> or <code>AI_API_KEY</code>) in the environment. No results are ever fabricated.
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
      </nav>

      {tab === "studio" && (
        <PhotographerStudio
          photos={photos}
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
          onAttributesComputed={onAttributesComputed}
          onPreview={setPreview}
        />
      )}
      {tab === "album" && <FullAlbum photos={photos} onPreview={setPreview} />}

      {confirmClear && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setConfirmClear(false)}>
          <div className="card" style={{ maxWidth: 420, width: "90%", margin: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 10px" }}>Clear Entire Album?</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 18px", fontSize: 14 }}>
              Remove all photos from this browser? This action cannot be undone.
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

      <Lightbox photo={preview} onClose={() => setPreview(null)} />

      <p className="footer-note">
        Visual-attribute search · No biometric facial recognition · Photos stay in your browser
        <br />
        University AI capstone prototype — use synthetic or consented images only.
      </p>
    </div>
  );
}
