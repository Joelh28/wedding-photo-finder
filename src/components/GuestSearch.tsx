import { useRef, useState } from "react";
import type { PhotoAttributes, RankedMatch, SearchCategory, StoredPhoto } from "../types";
import { SEARCH_CATEGORIES } from "../types";
import { analyzePhoto, searchByReference, searchByText } from "../lib/api";
import { fileToDataUrl, downloadDataUrl } from "../lib/files";
import { AttributeChips } from "./AttributeChips";

type Mode = "text" | "reference";

interface ResultRow extends RankedMatch {
  photo: StoredPhoto;
}

export function GuestSearch({
  photos,
  aiConfigured,
  onAttributesComputed,
  onPreview,
}: {
  photos: StoredPhoto[];
  aiConfigured: boolean;
  onAttributesComputed: (id: string, attributes: PhotoAttributes) => void;
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

  const disabled = !aiConfigured || photos.length === 0 || busy;

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
      const attributes = await analyzePhoto(p.dataUrl);
      onAttributesComputed(p.id, attributes);
      catalog.push({ id: p.id, attributes });
      analyzedCount++;
    }
    if (analyzedCount > 0) setStatus(`Analyzed ${analyzedCount} new photo(s). Ranking matches…`);
    return catalog;
  }

  async function runSearch() {
    setError(null);
    setResults(null);
    setBusy(true);
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
        const res = await searchByReference(referenceDataUrl, category, catalog);
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

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>🔎 Guest Search</h2>
          <p>Find photos by describing what you want, or by uploading a reference image.</p>
        </div>
      </div>

      {!aiConfigured && (
        <div className="banner warn">
          <span>⚠️</span>
          <div>
            <strong>AI search is not available</strong>
            The server has no AI provider configured, so searching is disabled (we never
            fabricate results). Set up an API key (e.g. GEMINI_API_KEY or AI_API_KEY) to enable
            AI-powered visual attribute search. The Photographer Studio and Full Album still work fully.
          </div>
        </div>
      )}

      {aiConfigured && photos.length === 0 && (
        <div className="banner info">
          <span>ℹ️</span>
          <div>Add photos in the Photographer Studio first, then come back to search.</div>
        </div>
      )}

      {/* Mode toggle */}
      <div className="tabs" style={{ justifyContent: "flex-start", margin: "4px 0 16px" }}>
        <button
          className={`tab${mode === "text" ? " active" : ""}`}
          onClick={() => setMode("text")}
        >
          📝 Text description
        </button>
        <button
          className={`tab${mode === "reference" ? " active" : ""}`}
          onClick={() => setMode("reference")}
        >
          🖼️ Reference image
        </button>
      </div>

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
                if (e.target.files?.[0]) void onReferenceSelected(e.target.files[0]);
                e.target.value = "";
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

      <button className="btn" disabled={disabled} onClick={() => void runSearch()}>
        {busy ? "Searching…" : "Search the album"}
      </button>

      {status && (
        <p className="progress">
          <span className="spinner" /> {status}
        </p>
      )}
      {error && (
        <div className="banner warn" style={{ marginTop: 14 }}>
          <span>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {results && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ marginBottom: 6 }}>
            {results.length} result{results.length === 1 ? "" : "s"} — ranked by relevance
          </h3>
          {results.length === 0 && <p className="empty">No matches found for this query.</p>}
          {results.map((r) => (
            <div className="result" key={r.id}>
              <img src={r.photo.dataUrl} alt={r.photo.name} onClick={() => onPreview(r.photo)} />
              <div className="body">
                <div>
                  <span className="score-label">{Math.round(r.score)}% match</span> — {r.photo.name}
                </div>
                <div className="scorebar">
                  <div style={{ width: `${Math.round(r.score)}%` }} />
                </div>
                <div className="rationale">{r.rationale || "Matched on visual attributes."}</div>
                <div className="actions">
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
          ))}
        </div>
      )}
    </section>
  );
}
