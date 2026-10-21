import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { getAiConfig, PORT } from "./server/env.ts";
import {
  analyzePhoto,
  rankByReference,
  rankByText,
  type PhotoAttributes,
} from "./server/ai.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(cors());
  // Allow generous payload size for base64 photo uploads
  app.use(express.json({ limit: "25mb" }));

  /**
   * Tells the client whether AI is available WITHOUT ever revealing the key.
   */
  app.get("/api/health", (_req, res) => {
    const cfg = getAiConfig();
    res.json({
      aiConfigured: Boolean(cfg),
      model: cfg?.model ?? null,
      provider: cfg?.provider ?? null,
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

  if (process.env.NODE_ENV === "production") {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0" },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const port = PORT;
  const host = "0.0.0.0";
  app.listen(port, host, () => {
    const cfg = getAiConfig();
    console.log(
      `[wedding-photo-finder] server running at http://${host}:${port} (AI ${
        cfg ? `configured via ${cfg.provider}: ${cfg.model}` : "NOT configured"
      })`
    );
  });
}

void startServer();
