# 💍 Wedding Photo Finder

An AI-powered web app that helps wedding guests quickly find relevant photos in
large albums by searching **observable visual attributes** — clothing, colors,
accessories, objects, and scenery — with **text** or a **reference image**.

> **Ethics first.** This project deliberately replaced the original
> facial-recognition concept with non-biometric visual-attribute search. It does
> **not** identify, recognize, or match individuals, and it never fabricates AI
> results.

Built with **React + TypeScript + Vite** and a tiny **Express** proxy that keeps
your AI API key server-side.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. (Optional but recommended) configure the AI provider
cp server/.env.example server/.env
#    then edit server/.env and set AI_API_KEY=...

# 3. Run the app (starts the Vite frontend + the backend proxy together)
npm run dev
```

Open the printed Vite URL (default **http://localhost:5173**).
The backend proxy runs on **http://localhost:8787** and Vite forwards `/api` to it.

> You can run the app **without** an API key — upload, gallery, and album browsing
> all work. AI search is cleanly disabled (with an on-screen notice) until a key
> is configured. **No fake results are ever generated.**

### Run pieces individually
```bash
npm run dev:web      # frontend only
npm run dev:server   # backend proxy only
npm run build        # typecheck + production build of the frontend
npm run typecheck    # typecheck frontend + server
```

---

## Configuring AI securely (where the key lives)

The API key is read **only** by the backend proxy from `server/.env`:

```env
AI_API_KEY=sk-...                      # required to enable AI search
# AI_BASE_URL=https://api.openai.com/v1  # optional: any OpenAI-compatible vision endpoint
# AI_MODEL=gpt-4o-mini                   # optional: must be vision-capable
```

- `server/.env` is **gitignored** — it is never committed.
- The key is **never** sent to the browser or bundled into frontend JavaScript.
- The browser calls our proxy (`/api/...`); the proxy adds the key and calls the
  vendor. The client only learns *whether* AI is configured via `/api/health`.

Defaults target **OpenAI** (`gpt-4o-mini`), but any OpenAI-compatible vision
endpoint works by overriding `AI_BASE_URL` / `AI_MODEL`.

---

## How a search works

1. Each album photo is analyzed **once** into observable attributes
   (clothing, colors, objects, scenery). Results are cached per-photo in
   IndexedDB, so re-searching is fast and avoids repeat API calls.
2. **Text search** sends your description + the cached attribute catalog to the
   model, which scores and explains each photo.
3. **Reference-image search** analyzes your uploaded image (same attributes) and
   ranks the album by visual-attribute similarity.
4. Results are ranked 0–100 with a rationale, and can be previewed and downloaded.

Photos are sent to the AI provider **only when you run a search**, and the app
tells you this up front.

---

## Feature status

### ✅ Implemented
- **Photographer Studio:** bulk upload (click + drag-and-drop), thumbnail gallery,
  success count, per-photo delete, clear album.
- **Browser-local storage:** photos persist in IndexedDB across reloads; no account,
  no database, no server-side photo storage.
- **Full Album** browse section with preview + download.
- **Secure backend AI proxy** (`/api/health`, `/api/analyze`, `/api/search/text`,
  `/api/search/reference`) with the key kept server-side.
- **Per-photo attribute analysis** using a real vision model (cached).
- **Guest text search** across the four categories, with ranked results +
  rationale + preview + download.
- **Guest reference-image similarity search.**
- **Graceful no-AI mode** (upload/album work; AI search disabled, never faked).
- **Consent / privacy banner** shown before any AI call.

### 🧭 Planned / future (not implemented)
- Multi-user sharing and cloud sync.
- A real database / persistent server storage.
- Video search and automatic cloud-album import.
- Bulk "pre-analyze whole album" button with a progress bar (today, photos are
  analyzed lazily on first search).
- Face/identity recognition — **intentionally excluded**, permanently.

---

## Testing checklist

**Setup**
- [ ] `npm install` completes without errors.
- [ ] `npm run dev` starts both the frontend and the proxy; the proxy logs whether
      AI is configured.

**Photographer Studio (no AI key required)**
- [ ] Select multiple images via the picker → they appear in the gallery.
- [ ] Drag-and-drop multiple images → they appear in the gallery.
- [ ] The "photos stored" count matches the number of images.
- [ ] The "Successfully uploaded N" message appears after a batch.
- [ ] Deleting a photo (×) removes it; the count updates.
- [ ] Reload the page → photos are still there (IndexedDB persistence).
- [ ] "Clear entire album" empties the gallery after confirmation.

**Full Album**
- [ ] Shows every stored photo with the correct total.
- [ ] Clicking a photo opens the full-size preview (Esc / × closes it).
- [ ] Download button saves the image.

**No-AI behavior (run with an empty `AI_API_KEY`)**
- [ ] A notice says AI is not configured.
- [ ] Guest Search shows the "AI search not available" banner and the Search button
      is disabled. **No results are fabricated.**

**Guest Search (with a valid `AI_API_KEY`)**
- [ ] The "AI search is ready" banner appears (shows the model name).
- [ ] **Text search:** enter a description, pick a category, Search → ranked
      results appear with % scores and a rationale per photo.
- [ ] First search shows "Analyzing photo X of N"; a second search is faster
      (attributes are cached — note the "AI ✓" badge on thumbnails in the Studio).
- [ ] Changing the category changes how photos rank.
- [ ] **Reference search:** upload a reference image → its detected attributes show,
      and the album is ranked by similarity with rationales.
- [ ] Preview and Download work from the results list.
- [ ] A provider error (e.g. bad key) surfaces a readable error, not a crash.

---

## Project structure

```
server/
  env.ts        # reads AI config/key from server/.env (server-side only)
  ai.ts         # vision calls + non-biometric prompt + attribute/ranking logic
  index.ts      # Express proxy: /api/health, /api/analyze, /api/search/*
  .env.example  # copy to server/.env and add your key
src/
  types.ts
  lib/{db,api,files}.ts         # IndexedDB store, proxy client, file helpers
  components/
    PhotographerStudio.tsx
    GuestSearch.tsx
    FullAlbum.tsx
    Lightbox.tsx
    AttributeChips.tsx
  App.tsx  main.tsx  styles.css
REQUIREMENTS.md        # full requirements & ethical constraints
DEVELOPMENT_PLAN.md    # architecture & milestones
```

---

## Ethical & privacy notes
- **No biometric facial recognition** or identity verification — by design.
- The vision prompt explicitly forbids identifying or matching people.
- Photos stay in your browser; they go to the AI provider **only** during a search,
  and only after the on-screen consent/privacy notice.
- No scraping of Google Photos or other external albums — uploads are manual only.
- Use **synthetic or consented** photos only.
