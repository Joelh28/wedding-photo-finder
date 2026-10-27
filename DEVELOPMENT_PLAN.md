# Wedding Photo Finder — Phase 2 Development Plan

## Overview
This plan outlines the implementation of three major features for Wedding Photo Finder:
1. **Smart Search Filtering** (threshold slider, hide 0% by default, show-all toggle)
2. **Favorites & Batch Download** (favorite marking, multi-select, client-side ZIP packaging)
3. **Search Feedback & Result Refinement** (thumbs up/down, attribute-guided refinement, transparent explanation)

---

## Technical Architecture & Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Browser Frontend                              │
│                                                                        │
│  ┌────────────────────┐   ┌─────────────────────┐   ┌───────────────┐  │
│  │ Smart Filter       │   │ Favorites & Select  │   │ Feedback Loop │  │
│  │ • Min % slider     │   │ • Heart toggle      │   │ • 👍 / 👎     │  │
│  │ • Hide 0% default  │   │ • JSZip batcher     │   │ • Attribute   │  │
│  │ • Show-all toggle  │   │ • Local ZIP export  │   │   re-weighting│  │
│  └────────────────────┘   └─────────────────────┘   └───────────────┘  │
│                               ▲                                        │
│                               │                                        │
│                   ┌───────────────────────┐                            │
│                   │ IndexedDB Store       │                            │
│                   │ • original photo data │                            │
│                   │ • cached attributes   │                            │
│                   │ • favorite flags      │                            │
│                   └───────────────────────┘                            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Feature Implementation Plan

### Feature 1: Smart Search Filtering
- **How it works**:
  - Filter state maintained in `GuestSearch.tsx`: `minMatchScore` (number 0–100, default `10%` to automatically filter out 0% and irrelevant matches) and `showAllZeroMatches` (boolean).
  - A compact slider with quick preset chips (`All`, `25%+`, `50%+`, `75%+`).
  - Filter is computed purely client-side from the ranked results returned by `gemini-3.1-flash-lite`, requiring **zero extra API calls** and updating instantaneously.
  - Informative count display: e.g. *"Showing 6 of 18 photos (≥ 25% match)"* with a button to *"Show all (including 0% matches)"*.

### Feature 2: Favorites & Batch Download
- **How it works**:
  - **IndexedDB Schema**: Add a `favorite?: boolean` field to `StoredPhoto` in `src/types.ts` and `src/lib/db.ts` (`toggleFavorite(id: string)`).
  - **Favorites UI**:
    - Heart button on photo cards in Search Results, Full Album, and Photographer Studio.
    - An optional "❤️ Favorites Only" filter toggle in the Full Album and Guest Search.
  - **Multi-Select**:
    - Selection checkboxes on result cards with a master "Select All Visible" / "Deselect All" control.
    - Action bar displays: `X photos selected`.
  - **Client-Side ZIP Generation**:
    - Add `jszip` library to package dependencies.
    - Convert selected stored photo data URLs (or blobs) into files inside a ZIP archive in memory.
    - Trigger immediate browser file download (`wedding-photos-selection.zip`) containing original high-resolution files.
    - Zero server interaction; zero latency or proxy payload limits.

### Feature 3: Search Feedback & Result Refinement
- **How it works**:
  - **Feedback Capture**:
    - Each search result card displays `👍 Relevant` and `👎 Not Relevant` buttons.
    - Stored in component session state: `feedback: Record<photoId, "positive" | "negative">`.
  - **Attribute-Guided Reranking (Client-Side, 0 API quota)**:
    - Extracts attribute keywords from photos marked 👍 (e.g. `outfitClothing: ["tuxedo", "bow tie"]`, `colors: ["black"]`).
    - Compares other candidate photos against these positive and negative anchors, boosting matching scores by +15% and demoting photos sharing features with 👎 items by -20%.
    - Photos marked 👎 are pushed to the bottom of the active list.
  - **Honest User Communication**:
    - Transparent disclaimer: *"Feedback refines ranking for your current search session using visual attribute weighting. It does not retrain the underlying Gemini model."*
    - "Reset Feedback" button to restore initial Gemini ranking at any time.

---

## Technical Limitations & API Considerations
1. **API Quota Preservation**:
   - Both Smart Filtering and Attribute-Guided Feedback are implemented client-side over the cached attributes catalog, requiring **0 extra API calls**.
2. **Memory Considerations for ZIP Packaging**:
   - Creating a ZIP of 50+ high-resolution camera images entirely in browser memory can exceed mobile browser memory limits (heap crash).
   - Solution: Use `JSZip.file(name, blob)` with sequential blob conversion, releasing object URLs to keep memory overhead below 150MB.
3. **Model Integrity**:
   - Pre-trained models cannot be fine-tuned or retrained in real time. The feedback mechanism adjusts candidate attribute weights mathematically in the client application.
