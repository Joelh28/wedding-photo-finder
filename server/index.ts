import express from "express";
import cors from "cors";
import { getAiConfig, PORT } from "./env.ts";
import {
  analyzePhoto,
  rankByReference,
  rankByText,
  type PhotoAttributes,
} from "./ai.ts";

const app = express();
app.use(cors());
// Wedding photos as data URLs can be large; allow a generous JSON body.
app.use(express.json({ limit: "25mb" }));

/**
 * Tells the client whether AI is available WITHOUT ever revealing the key.
 * The client uses this to enable/disable AI search and to avoid faking results.
 */
app.get("/api/health", (_req, res) => {
  const cfg = getAiConfig();
  res.json({
    aiConfigured: Boolean(cfg),
    model: cfg?.model ?? null,
  });
});

/** Analyze one photo into observable attributes. */
app.post("/api/analyze", async (req, res) => {
  const cfg = getAiConfig();
  if (!cfg) return res.status(503).json({ error: "AI_NOT_CONFIGURED" });

  const { imageDataUrl } = req.body as { imageDataUrl?: string };
  if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
    return res.status(400).json({ error: "imageDataUrl (data:image/...) required" });
  }

  try {
    const attributes = await analyzePhoto(cfg, imageDataUrl);
    res.json({ attributes });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/** Text search over already-analyzed photos. */
app.post("/api/search/text", async (req, res) => {
  const cfg = getAiConfig();
  if (!cfg) return res.status(503).json({ error: "AI_NOT_CONFIGURED" });

  const { query, category, photos } = req.body as {
    query?: string;
    category?: string;
    photos?: { id: string; attributes: PhotoAttributes }[];
  };
  if (!query?.trim()) return res.status(400).json({ error: "query required" });
  if (!Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ error: "photos array required" });
  }

  try {
    const matches = await rankByText(cfg, query, category ?? "Overall Visual Similarity", photos);
    res.json({ matches });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/** Reference-image similarity search over already-analyzed photos. */
app.post("/api/search/reference", async (req, res) => {
  const cfg = getAiConfig();
  if (!cfg) return res.status(503).json({ error: "AI_NOT_CONFIGURED" });

  const { referenceDataUrl, category, photos } = req.body as {
    referenceDataUrl?: string;
    category?: string;
    photos?: { id: string; attributes: PhotoAttributes }[];
  };
  if (!referenceDataUrl || !referenceDataUrl.startsWith("data:image/")) {
    return res.status(400).json({ error: "referenceDataUrl (data:image/...) required" });
  }
  if (!Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ error: "photos array required" });
  }

  try {
    const result = await rankByReference(
      cfg,
      referenceDataUrl,
      category ?? "Overall Visual Similarity",
      photos,
    );
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

app.listen(PORT, () => {
  const cfg = getAiConfig();
  // eslint-disable-next-line no-console
  console.log(
    `[wedding-photo-finder] proxy on http://localhost:${PORT} ` +
      `(AI ${cfg ? `configured: ${cfg.model}` : "NOT configured — AI search disabled"})`,
  );
});
