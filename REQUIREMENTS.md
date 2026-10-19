# Wedding Photo Finder — Requirements

> University AI capstone project. A web app that helps wedding guests quickly
> find relevant photos in large albums using **AI visual-attribute similarity
> search** — explicitly **not** facial recognition or biometric identification.

## 1. Product purpose

Wedding albums are large and hard to navigate. A guest usually knows what they
are looking for ("the person in the navy suit near the arch", "the table with
the blue flowers") but cannot easily scan hundreds of photos. Wedding Photo
Finder lets a guest describe what they want — in text or with a reference image —
and ranks the album by how well each photo matches **observable visual
attributes**.

## 2. Ethical & design constraints (hard requirements)

| # | Constraint | How it is honored |
|---|-----------|-------------------|
| E1 | No biometric facial recognition / identity verification | The AI is instructed to describe *observable attributes* (clothing, colors, objects, scenery) and is explicitly told **not** to identify, name, or match individuals. |
| E2 | No fake / fabricated AI results | If no AI provider is configured, AI search is **disabled** with a clear notice. Results shown always come from a real model call. |
| E3 | API keys never exposed in frontend | The key lives only in a server-side `.env`, read by a thin backend proxy. The browser calls our proxy, never the AI vendor directly. |
| E4 | Inform the user before sending photos to an external AI | A consent banner + an explicit "this sends the photo to the configured AI provider" notice gate every AI call. |
| E5 | Only synthetic / consented photos | README and in-app copy instruct users to upload only synthetic or consented images. |
| E6 | No account, no database | Photos live in the browser only (IndexedDB), cleared by the user at will. |
| E7 | No scraping of Google Photos / external albums | Upload is manual, local-file only. |

## 3. Functional requirements

### FR1 — Photographer Studio
- FR1.1 Upload **multiple** photos at once (file picker + drag-and-drop).
- FR1.2 Show the uploaded gallery as thumbnails.
- FR1.3 Show a count of photos successfully uploaded / stored.
- FR1.4 Persist photos across page reloads (browser-local) and allow clearing.

### FR2 — Guest Search
- FR2.1 Search by **text description** of what the guest is looking for.
- FR2.2 Search by **reference image** upload (visual similarity).
- FR2.3 Choose a **search category**: Outfit & Clothing, Objects & Accessories,
  Background & Location, Overall Visual Similarity.

### FR3 — AI Search
- FR3.1 Analyze observable attributes of each album photo (clothing, colors,
  accessories, objects, scenery) using a real vision model.
- FR3.2 Compare the query (text or reference image) against those attributes.
- FR3.3 Cache per-photo analysis so re-searching is fast and cheap.

### FR4 — Results
- FR4.1 Display matching photos ranked by relevance (0–100 score).
- FR4.2 For each result, explain **why** it matched (a short rationale).
- FR4.3 Preview a photo full-size.
- FR4.4 Download a photo.

### FR5 — Full Album
- FR5.1 Browse every stored photo in a dedicated section.

## 4. Non-functional requirements
- NFR1 React + TypeScript, responsive, elegant wedding-inspired UI.
- NFR2 Runs locally with `npm install` + a single run command.
- NFR3 Graceful degradation: album + gallery work with zero AI configured.
- NFR4 Clear separation between **implemented** and **planned** features (see README).

## 5. Out of scope (planned / future)
- Multi-user sharing, cloud storage, real database.
- Face/identity recognition (intentionally excluded forever).
- Video search, automatic album import from cloud providers.
