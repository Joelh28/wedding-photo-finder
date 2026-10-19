# Wedding Photo Finder — Development Plan

## Architecture

```
Browser (React + TS)                 Thin Node proxy (Express)        AI vendor
┌────────────────────────┐           ┌─────────────────────────┐     ┌──────────┐
│ Photographer Studio     │           │  /api/health            │     │ Vision   │
│ Guest Search            │  HTTP ──▶ │  /api/analyze (image)   │ ──▶ │ model    │
│ Full Album              │           │  /api/search (text)     │     │ (OpenAI- │
│                         │ ◀── JSON  │                         │ ◀── │ compat)  │
│ IndexedDB (photos)      │           │  reads API key from .env│     └──────────┘
└────────────────────────┘           └─────────────────────────┘
```

- **Photos never leave the browser except when the user runs an AI action**, and
  then they go only to *our* proxy, which forwards to the configured vendor.
- **API key** is read from `server/.env` (`AI_API_KEY`). Never shipped to the client.
- If the proxy reports AI is not configured, the client disables AI search and
  says so — no fabricated results.

## Tech stack
- Vite + React + TypeScript (frontend)
- Express (tiny backend proxy, TypeScript via tsx)
- IndexedDB via a small wrapper (no heavy dependency)
- OpenAI-compatible Chat Completions vision API (configurable base URL + model)

## Milestones (build order)

### M1 — Scaffold & Full Album storage  ✅ (this prototype)
Project setup, IndexedDB photo store, Full Album browse section.

### M2 — Photographer Studio (bulk upload + gallery + count)  ✅
Drag/drop + multi-select upload, thumbnail gallery, success count, clear.

### M3 — Backend AI proxy + per-photo attribute analysis  ✅
`/api/health`, `/api/analyze`. Attribute JSON cached per photo in IndexedDB.

### M4 — Text-based visual search  ✅
Guest enters text + category → rank album photos by attribute match, with
rationale, preview, download.

### M5 — Reference-image similarity search  ✅
Guest uploads a reference image → analyze it → rank album by similarity.

### M6 — Testing checklist + run instructions  ✅ (README)

## Testing checklist
See `README.md` → "Testing checklist".
