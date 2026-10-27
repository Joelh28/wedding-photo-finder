import { useRef, useState } from "react";
import type { DetectedFace, PhotoAttributes, RankedMatch, SearchCategory, StoredPhoto } from "../types";
import { SEARCH_CATEGORIES } from "../types";
import { analyzePhoto, searchByReference, searchByText } from "../lib/api";
import { fileToDataUrl, downloadDataUrl, prepareImageForAnalysis } from "../lib/files";
import {
  detectFacesInImage,
  cropFacePreview,
  rankPhotosByFace,
} from "../lib/faceMatcher";
import { AttributeChips } from "./AttributeChips";

type Mode = "text" | "reference" | "face";

interface ResultRow extends RankedMatch {
  photo: StoredPhoto;
}

interface SelfieFaceItem {
  id: string;
  box: { x: number; y: number; width: number; height: number };
  descriptor: number[];
  previewUrl: string;
}

export function GuestSearch({
  photos,
  aiConfigured,
  collectionIds,
  onToggleCollection,
  onAttributesComputed,
  onFacesComputed,
  onClearFaces,
  onPreview,
}: {
  photos: StoredPhoto[];
  aiConfigured: boolean;
  collectionIds?: Set<string>;
  onToggleCollection?: (photo: StoredPhoto) => void;
  onAttributesComputed: (id: string, attributes: PhotoAttributes) => void;
  onFacesComputed?: (id: string, faces: DetectedFace[]) => void;
  onClearFaces?: () => void;
  onPreview: (photo: StoredPhoto) => void;
}) {
  const [mode, setMode] = useState<Mode>("text");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("Overall Visual Similarity");
  const [referenceDataUrl, setReferenceDataUrl] = useState<string | null>(null);
  const [referenceAttributes, setReferenceAttributes] = useState<PhotoAttributes | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refInput = useRef<HTMLInputElement>(null);
  const faceInput = useRef<HTMLInputElement>(null);

  // Facial Recognition State (Find Me Feature)
  const [hasFaceConsent, setHasFaceConsent] = useState<boolean>(() => {
    return localStorage.getItem("wedding_face_consent") === "granted";
  });
  const [faceSelfieDataUrl, setFaceSelfieDataUrl] = useState<string | null>(null);
  const [selfieFaces, setSelfieFaces] = useState<SelfieFaceItem[]>([]);
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);
  const [faceMatchThreshold, setFaceMatchThreshold] = useState<number>(45);
  const [faceDataClearedMessage, setFaceDataClearedMessage] = useState<string | null>(null);

  // Smart Search Filtering (Phase 2.1)
  const [minMatchThreshold, setMinMatchThreshold] = useState<number>(1);
  const [showZeroMatches, setShowZeroMatches] = useState<boolean>(false);

  // Disabled condition: For text/reference, requires aiConfigured; For face search, runs on-device without Gemini
  const disabled =
    photos.length === 0 ||
    busy ||
    (mode !== "face" && !aiConfigured) ||
    (mode === "face" && (!selectedFaceId || !hasFaceConsent));

  // Filter results client-side without any additional Gemini API calls
  const visibleResults = results
    ? results.filter((r) => {
        if (showZeroMatches) return true;
        return r.score >= minMatchThreshold;
      })
    : null;

  const hiddenCount = results && visibleResults ? results.length - visibleResults.length : 0;

  /**
   * Make sure every album photo has cached attributes, analyzing any that
   * don't. Returns the catalog used for ranking.
   */
  async function ensureAnalyzed(): Promise<{ id: string; attributes: PhotoAttributes }[]> {
    const catalog: { id: string; attributes: PhotoAttributes }[] = [];
    let analyzedCount = 0;
    const toAnalyze = photos.filter((p) => !p.attributes);

    for (const p of photos) {
      if (p.attributes) {
        catalog.push({ id: p.id, attributes: p.attributes });
      }
    }
    for (let i = 0; i < toAnalyze.length; i++) {
      const p = toAnalyze[i];
      setStatus(`Analyzing photo ${i + 1} of ${toAnalyze.length} (one-time per photo)…`);
      // Resize to max 1024px JPEG for AI analysis without modifying original in IndexedDB
      const analysisDataUrl = await prepareImageForAnalysis(p.dataUrl);
      const attributes = await analyzePhoto(analysisDataUrl);
      onAttributesComputed(p.id, attributes);
      catalog.push({ id: p.id, attributes });
      analyzedCount++;
    }
    if (analyzedCount > 0) setStatus(`Analyzed ${analyzedCount} new photo(s). Ranking matches…`);
    return catalog;
  }

  async function runVisualSearch() {
    setError(null);
    setResults(null);
    setBusy(true);
    setMinMatchThreshold(1);
    setShowZeroMatches(false);
    try {
      const catalog = await ensureAnalyzed();
      const byId = new Map(photos.map((p) => [p.id, p]));

      let matches: RankedMatch[];
      if (mode === "text") {
        if (!query.trim()) throw new Error("Please enter a description to search for.");
        setStatus("Ranking matches against your description…");
        matches = await searchByText(query.trim(), category, catalog);
      } else {
        if (!referenceDataUrl) throw new Error("Please upload a reference image.");
        setStatus("Analyzing your reference image and ranking matches…");
        const analysisRef = await prepareImageForAnalysis(referenceDataUrl);
        const res = await searchByReference(analysisRef, category, catalog);
        setReferenceAttributes(res.referenceAttributes);
        matches = res.matches;
      }

      const rows: ResultRow[] = matches
        .map((m) => {
          const photo = byId.get(m.id);
          return photo ? { ...m, photo } : null;
        })
        .filter((r): r is ResultRow => r !== null);
      setResults(rows);
      setStatus(null);
    } catch (err) {
      setError((err as Error).message);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function onReferenceSelected(file: File) {
    const dataUrl = await fileToDataUrl(file);
    setReferenceDataUrl(dataUrl);
    setReferenceAttributes(null);
    setResults(null);
  }

  // --- Find Me (Facial Recognition) Handlers ---

  async function onSelfieSelected(file: File) {
    setError(null);
    setResults(null);
    setFaceDataClearedMessage(null);
    setStatus("Reading selfie photo…");
    setBusy(true);

    try {
      const dataUrl = await fileToDataUrl(file);
      setFaceSelfieDataUrl(dataUrl);
      setStatus("Loading on-device face detector and scanning selfie…");

      const detected = await detectFacesInImage(dataUrl);
      if (detected.length === 0) {
        setSelfieFaces([]);
        setSelectedFaceId(null);
        setError("No face was detected in this photo. Please upload a clear, well-lit photo where your face is visible.");
        setBusy(false);
        setStatus(null);
        return;
      }

      setStatus(`Generating face previews for ${detected.length} detected face(s)…`);
      const items: SelfieFaceItem[] = [];
      for (const f of detected) {
        const previewUrl = await cropFacePreview(dataUrl, f.box);
        items.push({
          id: f.id,
          box: f.box,
          descriptor: f.descriptor,
          previewUrl,
        });
      }

      setSelfieFaces(items);
      // Automatically select the first face; if multiple, user can pick below
      setSelectedFaceId(items[0].id);
      setStatus(null);
    } catch (err) {
      console.error("[Face Detection Error]", err);
      setError((err as Error).message || "Failed to process face in reference photo.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function runFaceSearch() {
    const activeFace = selfieFaces.find((f) => f.id === selectedFaceId);
    if (!activeFace) {
      setError("Please select a face from your uploaded reference selfie first.");
      return;
    }

    setError(null);
    setResults(null);
    setBusy(true);
    setMinMatchThreshold(1);
    setShowZeroMatches(false);

    try {
      // Step 1: Detect faces in any album photos that have not been scanned yet
      const unanalyzed = photos.filter((p) => !p.faces);
      if (unanalyzed.length > 0) {
        for (let i = 0; i < unanalyzed.length; i++) {
          const p = unanalyzed[i];
          setStatus(`Scanning album photo ${i + 1} of ${unanalyzed.length} for faces (local on-device)…`);
          const faces = await detectFacesInImage(p.dataUrl);
          p.faces = faces;
          if (onFacesComputed) {
            onFacesComputed(p.id, faces);
          }
        }
      }

      // Step 2: Compare selected reference face with all detected faces across photos
      setStatus("Comparing facial geometry across album photos…");
      const matches = rankPhotosByFace(activeFace.descriptor, photos, faceMatchThreshold);

      const byId = new Map(photos.map((p) => [p.id, p]));
      const rows: ResultRow[] = matches
        .map((m) => {
          const photo = byId.get(m.id);
          return photo ? { ...m, photo } : null;
        })
        .filter((r): r is ResultRow => r !== null);

      setResults(rows);
      setStatus(null);
    } catch (err) {
      console.error("[Facial Search Error]", err);
      setError((err as Error).message || "Facial similarity search failed.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleClearFaceData() {
    if (onClearFaces) {
      await onClearFaces();
    }
    setFaceSelfieDataUrl(null);
    setSelfieFaces([]);
    setSelectedFaceId(null);
    setResults(null);
    setFaceDataClearedMessage("All local face descriptors and reference templates have been cleared.");
    setTimeout(() => setFaceDataClearedMessage(null), 5000);
  }

  const selectedFaceItem = selfieFaces.find((f) => f.id === selectedFaceId);

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>🔎 Guest Search</h2>
          <p>Find photos by visual attributes (Gemini) or find yourself using on-device facial matching.</p>
        </div>
      </div>

      {!aiConfigured && mode !== "face" && (
        <div className="banner warn">
          <span>⚠️</span>
          <div>
            <strong>AI visual search is not available</strong>
            The server has no AI provider configured for text and attribute search. However, <strong>👤 Find Me (Facial Recognition)</strong> runs entirely on-device and remains fully available!
          </div>
        </div>
      )}

      {photos.length === 0 && (
        <div className="banner info">
          <span>ℹ️</span>
          <div>Add photos in the Photographer Studio first, then come back to search.</div>
        </div>
      )}

      {/* Mode toggle */}
      <div className="tabs" style={{ justifyContent: "flex-start", margin: "4px 0 16px" }}>
        <button
          className={`tab${mode === "text" ? " active" : ""}`}
          onClick={() => {
            setMode("text");
            setError(null);
            setResults(null);
          }}
        >
          📝 Text description
        </button>
        <button
          className={`tab${mode === "reference" ? " active" : ""}`}
          onClick={() => {
            setMode("reference");
            setError(null);
            setResults(null);
          }}
        >
          🖼️ Reference image
        </button>
        <button
          className={`tab${mode === "face" ? " active" : ""}`}
          onClick={() => {
            setMode("face");
            setError(null);
            setResults(null);
          }}
        >
          👤 Find Me (Facial Recognition)
        </button>
      </div>

      {faceDataClearedMessage && (
        <div className="banner ok" style={{ margin: "10px 0" }}>
          <span>✓</span>
          <div>{faceDataClearedMessage}</div>
        </div>
      )}

      {/* --- Mode 1 & 2: Text / Reference Visual Search (Gemini) --- */}
      {mode !== "face" && (
        <>
          <div className="field">
            <label>Search category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SearchCategory)}
            >
              {SEARCH_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {mode === "text" ? (
            <div className="field">
              <label>Describe what you are looking for</label>
              <textarea
                placeholder="e.g. guest in a navy blue suit holding a champagne glass near the floral arch"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          ) : (
            <div className="field">
              <label>Reference image</label>
              <div className="row" style={{ alignItems: "center" }}>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => refInput.current?.click()}
                  style={{ flex: "none" }}
                >
                  Choose image…
                </button>
                {referenceDataUrl && (
                  <img
                    src={referenceDataUrl}
                    alt="reference"
                    style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 10, flex: "none" }}
                  />
                )}
                <input
                  ref={refInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onReferenceSelected(f);
                  }}
                />
              </div>
              {referenceAttributes && (
                <div style={{ marginTop: 10 }}>
                  <strong style={{ fontSize: 13 }}>Detected in your reference:</strong>
                  <AttributeChips attributes={referenceAttributes} />
                </div>
              )}
            </div>
          )}

          <button className="btn" disabled={disabled} onClick={() => void runVisualSearch()}>
            {busy ? "Searching…" : "Search the album"}
          </button>
        </>
      )}

      {/* --- Mode 3: Find Me (On-Device Facial Recognition) --- */}
      {mode === "face" && (
        <>
          {!hasFaceConsent ? (
            /* Explicit Opt-In Consent Form */
            <div className="face-consent-card">
              <h3>🔒 Opt-In: On-Device Facial Recognition</h3>
              <p>
                <strong>Find Me</strong> enables wedding guests to search the album for photos containing their face using on-device biometric geometry matching.
              </p>
              <ul className="face-consent-list">
                <li>
                  <strong>100% On-Device &amp; Private:</strong> All face detection and geometry vector matching executes entirely inside your browser using client-side machine learning. Neither your selfie nor your facial geometry templates are ever sent to Gemini, external APIs, or remote servers.
                </li>
                <li>
                  <strong>Authorized Use Only:</strong> Please only activate this feature on wedding albums where you have permission to search, and only use photos of yourself or individuals who have explicitly consented.
                </li>
                <li>
                  <strong>No Identity Profiling:</strong> The algorithm compares mathematical facial descriptors only; it does not identify people by name or determine demographics.
                </li>
                <li>
                  <strong>Full Data Control:</strong> You can clear all cached face descriptors and your reference selfie at any time with the "Clear Face Data" button.
                </li>
              </ul>
              <div className="face-consent-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    localStorage.setItem("wedding_face_consent", "granted");
                    setHasFaceConsent(true);
                  }}
                >
                  ✓ I Consent &amp; Enable Find Me
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setMode("text")}
                >
                  Cancel (Use Visual Search)
                </button>
              </div>
            </div>
          ) : (
            /* Consented Interface */
            <div>
              <div className="field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                  <label style={{ margin: 0 }}>Upload your selfie or portrait photo</label>
                  {photos.some((p) => p.faces && p.faces.length > 0) && (
                    <button
                      type="button"
                      className="btn ghost small"
                      style={{ color: "var(--muted)" }}
                      onClick={() => void handleClearFaceData()}
                      title="Delete all cached face descriptors from this browser"
                    >
                      🗑 Clear Face Data
                    </button>
                  )}
                </div>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 12px" }}>
                  Upload a clear, front-facing photo with good lighting. If multiple people are in the photo, you can select which face is yours below.
                </p>

                <div className="row" style={{ alignItems: "center" }}>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => faceInput.current?.click()}
                    style={{ flex: "none" }}
                    disabled={busy}
                  >
                    {faceSelfieDataUrl ? "Choose different photo…" : "Upload selfie or portrait…"}
                  </button>
                  <input
                    ref={faceInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onSelfieSelected(f);
                    }}
                  />
                </div>
              </div>

              {/* Multi-Face Disambiguation Selector */}
              {selfieFaces.length > 1 && (
                <div className="face-picker-container">
                  <strong style={{ fontSize: 14, color: "var(--ink)" }}>
                    👥 Multiple faces detected ({selfieFaces.length}) — Click your face to search:
                  </strong>
                  <div className="face-picker-grid">
                    {selfieFaces.map((f, idx) => {
                      const isSelected = f.id === selectedFaceId;
                      return (
                        <div
                          key={f.id}
                          className={`face-crop-item ${isSelected ? "selected" : ""}`}
                          onClick={() => setSelectedFaceId(f.id)}
                        >
                          <img src={f.previewUrl} alt={`Face ${idx + 1}`} />
                          <div className="face-crop-label">
                            {isSelected ? "✓ Selected" : `Person ${idx + 1}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected Face Confirmation Banner */}
              {selectedFaceItem && (
                <div className="face-selected-banner">
                  <img src={selectedFaceItem.previewUrl} alt="Selected face" />
                  <div className="face-selected-info">
                    <strong>✓ Face Ready for Matching</strong>
                    <p>
                      128-dimensional facial geometry template extracted. Group wedding photos will be checked for this face.
                    </p>
                  </div>
                </div>
              )}

              {/* Match Sensitivity Threshold Slider */}
              <div className="field" style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <label htmlFor="face-threshold">
                    Match Sensitivity Threshold: <strong>{faceMatchThreshold}%</strong>
                  </label>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {faceMatchThreshold >= 60
                      ? "Strict (Few, high-confidence matches)"
                      : faceMatchThreshold >= 45
                      ? "Balanced (Recommended for wedding albums)"
                      : "Lenient (Surfaces small or distant group faces)"}
                  </span>
                </div>
                <input
                  id="face-threshold"
                  type="range"
                  min="30"
                  max="70"
                  step="5"
                  value={faceMatchThreshold}
                  onChange={(e) => setFaceMatchThreshold(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--rose)", cursor: "pointer" }}
                />
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
                  Similarity represents estimated facial landmark distance (not a biometric proof of identity). Photos below this threshold will not be shown.
                </p>
              </div>

              <div style={{ marginTop: 16 }}>
                <button
                  className="btn"
                  disabled={disabled}
                  onClick={() => void runFaceSearch()}
                >
                  {busy ? "Scanning Album Faces…" : "Find Me in Wedding Album"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {status && (
        <p className="progress">
          <span className="spinner" /> {status}
        </p>
      )}
      {error && (
        <div className="banner warn" style={{ marginTop: 14 }}>
          <span>⚠️</span>
          <div>
            <div>{error}</div>
            {(error.includes("503") ||
              error.toLowerCase().includes("unavailable") ||
              error.toLowerCase().includes("high demand")) &&
              !error.includes("429") && (
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn small"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (mode === "face") void runFaceSearch();
                      else void runVisualSearch();
                    }}
                  >
                    🔄 Retry Analysis
                  </button>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Results View & Smart Search Filtering */}
      {results && (
        <div style={{ marginTop: 20 }}>
          {/* Smart Search Filter Bar (Phase 2.1) */}
          <div className="filter-bar">
            <div className="filter-header">
              <div className="filter-title">
                <strong>Smart Search Filter</strong>
                <span className="filter-count">
                  Showing <strong>{visibleResults?.length ?? 0}</strong> of <strong>{results.length}</strong> photos
                  {hiddenCount > 0 && !showZeroMatches && (
                    <span className="hidden-note">
                      {" "}
                      ({hiddenCount} {hiddenCount === 1 ? "photo" : "photos"} with &lt;{minMatchThreshold}% match hidden)
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                className={`btn small ${showZeroMatches ? "sage" : "ghost"}`}
                onClick={() => {
                  if (showZeroMatches) {
                    setShowZeroMatches(false);
                    setMinMatchThreshold(1);
                  } else {
                    setShowZeroMatches(true);
                    setMinMatchThreshold(0);
                  }
                }}
              >
                {showZeroMatches ? "✓ Showing All Scored" : "Show All Scored Photos"}
              </button>
            </div>

            <div className="filter-controls">
              <div className="slider-group">
                <label htmlFor="relevance-slider">
                  Min Match: <strong>{showZeroMatches ? "0% (All)" : `${minMatchThreshold}%`}</strong>
                </label>
                <input
                  id="relevance-slider"
                  type="range"
                  min="0"
                  max="90"
                  step="5"
                  value={showZeroMatches ? 0 : minMatchThreshold}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val === 0) {
                      setShowZeroMatches(true);
                      setMinMatchThreshold(0);
                    } else {
                      setShowZeroMatches(false);
                      setMinMatchThreshold(val);
                    }
                  }}
                />
              </div>

              <div className="preset-chips">
                <span className="preset-label">Quick filters:</span>
                <button
                  type="button"
                  className={`chip-btn ${showZeroMatches ? "active" : ""}`}
                  onClick={() => {
                    setShowZeroMatches(true);
                    setMinMatchThreshold(0);
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`chip-btn ${!showZeroMatches && minMatchThreshold === 25 ? "active" : ""}`}
                  onClick={() => {
                    setShowZeroMatches(false);
                    setMinMatchThreshold(25);
                  }}
                >
                  ≥25%
                </button>
                <button
                  type="button"
                  className={`chip-btn ${!showZeroMatches && minMatchThreshold === 50 ? "active" : ""}`}
                  onClick={() => {
                    setShowZeroMatches(false);
                    setMinMatchThreshold(50);
                  }}
                >
                  ≥50%
                </button>
                <button
                  type="button"
                  className={`chip-btn ${!showZeroMatches && minMatchThreshold === 75 ? "active" : ""}`}
                  onClick={() => {
                    setShowZeroMatches(false);
                    setMinMatchThreshold(75);
                  }}
                >
                  ≥75%
                </button>
              </div>
            </div>
          </div>

          <h3 style={{ marginBottom: 12 }}>
            {visibleResults?.length ?? 0} result{(visibleResults?.length ?? 0) === 1 ? "" : "s"} — ranked by {mode === "face" ? "facial similarity" : "relevance"}
          </h3>

          {results.length === 0 && (
            <p className="empty">
              {mode === "face"
                ? "No matching faces found in the album meeting the current sensitivity threshold. Try adjusting the threshold slider or choosing a different selfie."
                : "No matches found for this query."}
            </p>
          )}

          {results.length > 0 && (visibleResults?.length ?? 0) === 0 && (
            <div className="empty" style={{ padding: "30px 10px" }}>
              <p>
                No photos meet the current <strong>≥{minMatchThreshold}%</strong> relevance filter.
              </p>
              <button
                type="button"
                className="btn small ghost"
                style={{ marginTop: 10 }}
                onClick={() => {
                  setShowZeroMatches(true);
                  setMinMatchThreshold(0);
                }}
              >
                Show All {results.length} Photos
              </button>
            </div>
          )}

          {visibleResults?.map((r) => {
            const isHighMatch = r.score >= 80;
            const isModerateMatch = r.score >= 60 && r.score < 80;

            return (
              <div className="result" key={r.id}>
                <img src={r.photo.dataUrl} alt={r.photo.name} onClick={() => onPreview(r.photo)} />
                <div className="body">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="score-label">{Math.round(r.score)}% match</span>
                    {mode === "face" && (
                      <span
                        className="chip"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          background: isHighMatch ? "#eef7ee" : isModerateMatch ? "#fef8ee" : "#fdf5f5",
                          borderColor: isHighMatch ? "#bedfbe" : isModerateMatch ? "#f0d4a8" : "#f3c7c7",
                          color: isHighMatch ? "#2b662b" : isModerateMatch ? "#8c5e18" : "#993a3a",
                        }}
                      >
                        {isHighMatch ? "★ High Confidence" : isModerateMatch ? "Moderate Confidence" : "Possible Match"}
                      </span>
                    )}
                    <span>— {r.photo.name}</span>
                  </div>
                  <div className="scorebar">
                    <div style={{ width: `${Math.round(r.score)}%` }} />
                  </div>
                  <div className="rationale">{r.rationale || (mode === "face" ? "Matched facial geometry." : "Matched on visual attributes.")}</div>
                  <div className="actions">
                    {onToggleCollection && (
                      <button
                        type="button"
                        className={`btn small ${collectionIds?.has(r.photo.id) ? "gold" : "ghost"}`}
                        onClick={() => onToggleCollection(r.photo)}
                      >
                        {collectionIds?.has(r.photo.id) ? "✓ In Collection" : "🎁 Save to Collection"}
                      </button>
                    )}
                    <button className="btn small" onClick={() => onPreview(r.photo)}>
                      Preview
                    </button>
                    <button
                      className="btn small sage"
                      onClick={() => downloadDataUrl(r.photo.dataUrl, r.photo.name)}
                    >
                      ⬇ Download
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
