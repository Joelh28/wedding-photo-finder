import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { getAiConfig, PORT } from "./server/env.ts";
import {
  analyzePhoto,
  rankByReference,
  rankByText,
  formatAiError,
  type PhotoAttributes,
} from "./server/ai.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(cors());
  // 10mb accommodates 1024px compressed analysis images with ample headroom
  app.use(express.json({ limit: "10mb" }));

  /**
   * Health check endpoint: verifies AI availability without exposing keys.
   */
  app.get("/api/health", (_req, res) => {
    const cfg = getAiConfig();
    res.json({
      aiConfigured: Boolean(cfg),
      visionModel: cfg?.visionModel ?? null,
      textModel: cfg?.textModel ?? null,
      model: cfg?.model ?? null,
      provider: cfg?.provider ?? null,
    });
  });

  /** Analyze one photo into observable attributes. */
  app.post("/api/analyze", async (req, res) => {
    const cfg = getAiConfig();
    if (!cfg) {
      return res.status(400).json({ error: "AI_NOT_CONFIGURED" });
    }

    const { imageDataUrl } = req.body as { imageDataUrl?: string };
    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "imageDataUrl (data:image/...) required" });
    }

    try {
      const attributes = await analyzePhoto(cfg, imageDataUrl);
      res.json({ attributes });
    } catch (err) {
      console.error("[Analyze Photo Error]", err);
      // NOTE: We return 500 (not 502/503/504) so that reverse proxies like Nginx
      // do not intercept the response with proxy_intercept_errors HTML.
      res.status(500).json({ error: formatAiError(err) });
    }
  });

  /** Text search over already-analyzed photos. */
  app.post("/api/search/text", async (req, res) => {
    const cfg = getAiConfig();
    if (!cfg) {
      return res.status(400).json({ error: "AI_NOT_CONFIGURED" });
    }

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
      console.error("[Search Text Error]", err);
      res.status(500).json({ error: formatAiError(err) });
    }
  });

  /** Reference-image similarity search over already-analyzed photos. */
  app.post("/api/search/reference", async (req, res) => {
    const cfg = getAiConfig();
    if (!cfg) {
      return res.status(400).json({ error: "AI_NOT_CONFIGURED" });
    }

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
      console.error("[Search Reference Error]", err);
      res.status(500).json({ error: formatAiError(err) });
    }
  });

  // Guarantee that any unmatched /api/* route returns JSON (not HTML from Vite/SPA)
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
  });

  // Global JSON error handler (e.g. body-parser errors, payload too large)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[API Middleware Error]", err);
    if (err.type === "entity.too.large" || err.status === 413) {
      return res.status(413).json({
        error: "Photo payload exceeds the 10MB limit. Photos are automatically resized to 1024px before analysis.",
      });
    }
    res.status(err.status && err.status < 500 ? err.status : 500).json({
      error: err.message || "Internal server error",
    });
  });

  // Vite development middleware or static production serving
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
