# Product Requirements Document (PRD) — Wedding Photo Finder

## 1. Product Name & Overview
**Wedding Photo Finder** is an AI-assisted wedding photo discovery application. It allows couples and guests to explore large wedding albums by searching for observable visual details (clothing, colors, accessories, and settings) using Google Gemini, while keeping full-resolution photos stored privately inside the browser via IndexedDB.

---

## 2. Target Users & Core Value
- **Wedding Guests**: Quickly locate photos of themselves, their partners, family, or party groups based on what they wore or where they were standing, without manual scanning.
- **Couples & Photographers**: Curate and share albums with privacy-first, non-biometric visual search that avoids creepy facial profiling while making photo retrieval fast.

---

## 3. Existing Functionality (Phase 1 — Operational)

### 3.1 Album Ingestion & Storage (Photographer Studio)
- **Local Storage**: Bulk upload images (JPEG, PNG, WebP) directly into IndexedDB.
- **Privacy First**: Original full-resolution files stay in the user's browser.
- **Album Management**: View thumbnails, delete individual photos, clear album, and view live photo counts.
- **Analysis Status Badges**: Displays "AI ✓" for cached photos or "not analyzed" (pending).

### 3.2 Multimodal Visual Attribute Extraction (`gemini-3.6-flash`)
- **Strict Non-Biometric Extraction**: Extracts only observable visual details:
  - `outfitClothing`: Suits, dresses, ties, colors, styles.
  - `objectsAccessories`: Champagne glasses, bouquets, sunglasses, jewelry.
  - `backgroundLocation`: Altar, dance floor, garden, banquet tables.
  - `colors`: Dominant color palette.
  - `sceneType`: Ceremony, cocktail hour, reception dinner, dancing.
- **Client-Side Pre-Processing**: Images are downscaled on HTML5 Canvas to max 1024px JPEG (~150–250KB) before transmission to `/api/analyze`, preserving original files in IndexedDB.
- **Persistent Caching**: Attributes are saved to IndexedDB; photos are analyzed only once.

### 3.3 Search & Ranking (`gemini-3.1-flash-lite`)
- **Natural Language Text Search**: Scores photos against queries (0% to 100%) and provides explainable rationales.
- **Reference Image Search**: Uploads a reference image (e.g., outfit photo), extracts attributes with `gemini-3.6-flash`, and ranks album with `gemini-3.1-flash-lite`.
- **Search Categories**: Allows focusing relevance on *Outfit & Clothing*, *Objects & Accessories*, *Background & Location*, or *Overall Visual Similarity*.
- **Full Album & Lightbox**: Interactive gallery with full-resolution photo lightbox and downloads.
- **Error Resilience**: User-actionable "Retry Analysis" button for transient 503 errors and distinct 429 quota messaging.

---

## 4. Proposed New Functionality (Phase 2)

### 4.1 Feature 1: Smart Search Filtering
- **Objective**: Reduce visual clutter and let users quickly surface true matches.
- **Requirements**:
  - **Hide 0% Relevance by Default**: Photos with 0% match score are filtered out of the default results view.
  - **Adjustable Match Threshold Filter**: An interactive slider or numeric control (0% to 100%) enabling users to set a minimum match threshold (e.g., "Only show 40%+ matches").
  - **Show All Results Toggle**: A quick toggle or button ("Show all X results") allowing users to view the complete catalog including low and 0% matches.
  - **Result Counter**: Displays live counts (e.g., *"Showing 8 of 24 photos (≥ 30% match)"*).

### 4.2 Feature 2: My Photo Collection & Batch ZIP Download (Implemented)
- **Objective**: Allow guests to curate their personal collection of photos discovered through text search, reference image search, facial recognition, or the full album, and download them together in a single ZIP archive.
- **Key Capabilities**:
  - **Save to Collection Buttons**: Available across all views (search result cards, full album grid, photographer studio, and the lightbox modal).
  - **Independent & Deduplicated**: Prevents duplicates by photo ID and persists collection IDs locally in browser storage across page refreshes and multiple search queries.
  - **Live Counter Badge**: Navigation tab displays real-time count: `🎁 My Collection (X)`.
  - **Batch ZIP Download**: Uses client-side `JSZip` to package full-resolution originals into `wedding-photos-collection-X.zip` in-browser with zero server uploads or fees.
  - **Automatic Pruning**: Automatically removes items from the collection if they are deleted from the album.
  - **Collection Management**: Easily remove individual photos or clear the entire collection with confirmation.

### 4.3 Feature 3: Search Feedback & Result Refinement
- **Objective**: Let guests steer and refine search results when initial ranking is ambiguous.
- **Requirements**:
  - **Feedback Controls**:
    - Inline thumbs-up (👍 Relevant) and thumbs-down (👎 Irrelevant) buttons on each result card.
    - Visual indicators showing applied feedback status.
  - **Result Refinement Mechanism**:
    - **Client-Side Attribute Weighting**: Dynamically boosts photos sharing attributes with thumbs-up items and demotes photos sharing negative attributes with thumbs-down items.
    - **Active Search Refinement**: A "Refine Search with Feedback" action that factors guest ratings into the current query context.
  - **Transparency & Trust**:
    - Explicit disclaimer: *"Feedback adjusts weighting for this search session only. It does not retrain or alter the underlying AI model."*

### 4.4 Feature 4: Find Me — On-Device Facial Recognition
- **Objective**: Allow guests to locate photos of themselves across the wedding album using on-device biometric face geometry matching.
- **Privacy & Consent Guarantees**:
  - **100% On-Device Processing**: Runs client-side using `@vladmandic/face-api` (TensorFlow.js) and local static models. No face images or biometric descriptors are ever transmitted to Gemini or external APIs.
  - **Explicit Opt-In Consent**: Requires explicit user consent before activating the feature or downloading model weights.
  - **Multi-Person Disambiguation**: If a reference selfie has multiple people, prompts the user to select their face.
  - **Group Photo Matching**: Detects and extracts separate embeddings for all faces in group wedding photos, matching photos where any face matches the reference.
  - **Estimated Similarity Scoring**: Displays estimated facial match percentages, calibrated distance metrics, and confidence badges (High, Moderate, Possible).
  - **Data Erasure**: Includes a "Clear Face Data" button to instantly purge all stored facial embeddings and reference templates.

---

## 5. Non-Functional Requirements & Privacy Constraints
- **Independent Biometric Architecture**: Facial recognition is completely decoupled from Gemini visual-attribute search.
- **Local Storage First**: Photos remain stored in the user's browser; facial embeddings are stored locally in IndexedDB.
- **Zero Paid Services & Quota Preservation**: Facial matching uses 0 Gemini API calls and introduces no third-party paid services.

