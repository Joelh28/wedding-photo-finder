import type { AiConfig } from "./env.ts";

/**
 * Shared, strongly-typed shape for the observable visual attributes we extract
 * from a photo. This is deliberately about *things you can see* — clothing,
 * colors, objects, scenery — and explicitly NOT about identifying people.
 */
export interface PhotoAttributes {
  summary: string;
  outfitClothing: string[];
  objectsAccessories: string[];
  backgroundLocation: string[];
  colors: string[];
  sceneType: string;
}

const EMPTY_ATTRIBUTES: PhotoAttributes = {
  summary: "",
  outfitClothing: [],
  objectsAccessories: [],
  backgroundLocation: [],
  colors: [],
  sceneType: "",
};

/**
 * System instruction shared by all vision calls. The non-biometric policy is
 * encoded here so the model never does identity matching.
 */
const SYSTEM_PROMPT = [
  "You analyze wedding photographs for a visual search tool.",
  "Describe only OBSERVABLE VISUAL ATTRIBUTES: clothing, colors, accessories,",
  "objects, and scenery/background.",
  "STRICT POLICY: Do NOT identify, name, recognize, or attempt to match specific",
  "individuals. Do NOT describe biometric facial features or infer identity, age,",
  "ethnicity, or any protected attribute. Treat people only as wearers of",
  "clothing and holders of objects.",
  "Always respond with a single JSON object and nothing else.",
].join(" ");

interface ChatMessageContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

async function callVision(
  cfg: AiConfig,
  userContent: ChatMessageContent[],
): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI provider returned ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI provider returned an empty response.");
  return content;
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    // Some providers wrap JSON in code fences; strip them defensively.
    const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function normalizeAttributes(obj: Record<string, unknown>): PhotoAttributes {
  return {
    summary: typeof obj.summary === "string" ? obj.summary : "",
    outfitClothing: toStringArray(obj.outfitClothing),
    objectsAccessories: toStringArray(obj.objectsAccessories),
    backgroundLocation: toStringArray(obj.backgroundLocation),
    colors: toStringArray(obj.colors),
    sceneType: typeof obj.sceneType === "string" ? obj.sceneType : "",
  };
}

/** Analyze a single photo (data URL) into observable attributes. */
export async function analyzePhoto(
  cfg: AiConfig,
  imageDataUrl: string,
): Promise<PhotoAttributes> {
  const instruction = [
    "Analyze this wedding photo. Return JSON with EXACTLY these keys:",
    '"summary" (one sentence, no people identification),',
    '"outfitClothing" (array of clothing items + their colors/styles),',
    '"objectsAccessories" (array of notable objects and accessories),',
    '"backgroundLocation" (array describing the setting/background),',
    '"colors" (array of dominant colors),',
    '"sceneType" (short label e.g. "outdoor ceremony", "reception dinner").',
  ].join(" ");

  const raw = await callVision(cfg, [
    { type: "text", text: instruction },
    { type: "image_url", image_url: { url: imageDataUrl } },
  ]);
  return normalizeAttributes(safeParse<Record<string, unknown>>(raw, {}));
}

export interface RankedMatch {
  id: string;
  score: number;
  rationale: string;
}

/**
 * Rank already-analyzed photos against a query. We send the model the compact
 * attribute JSON for each photo (NOT the images again) plus the query, and ask
 * for scores + rationales. This keeps re-search fast and cheap.
 */
export async function rankByText(
  cfg: AiConfig,
  query: string,
  category: string,
  photos: { id: string; attributes: PhotoAttributes }[],
): Promise<RankedMatch[]> {
  const catalog = photos.map((p) => ({ id: p.id, attributes: p.attributes }));
  const instruction = [
    `A wedding guest is searching with category "${category}".`,
    `Their query: "${query}".`,
    "Below is a JSON array of photos, each with an id and observable attributes.",
    "Score how well each photo matches the query from 0 to 100 based ONLY on the",
    "attributes relevant to the chosen category (or all attributes for Overall",
    "Visual Similarity). Do not invent attributes that are not listed.",
    "Return JSON: { \"matches\": [ { \"id\": string, \"score\": number,",
    '"rationale": string } ] }, including every photo, sorted by score desc.',
    "The rationale must cite the specific attributes that matched.",
    `PHOTOS: ${JSON.stringify(catalog)}`,
  ].join(" ");

  const raw = await callVision(cfg, [{ type: "text", text: instruction }]);
  const parsed = safeParse<{ matches?: unknown }>(raw, { matches: [] });
  return normalizeMatches(parsed.matches);
}

/**
 * Rank album photos against a reference image. The reference image is analyzed
 * first (same non-biometric attributes), then compared to the album catalog.
 */
export async function rankByReference(
  cfg: AiConfig,
  referenceDataUrl: string,
  category: string,
  photos: { id: string; attributes: PhotoAttributes }[],
): Promise<{ referenceAttributes: PhotoAttributes; matches: RankedMatch[] }> {
  const referenceAttributes = await analyzePhoto(cfg, referenceDataUrl);
  const catalog = photos.map((p) => ({ id: p.id, attributes: p.attributes }));

  const instruction = [
    `A wedding guest uploaded a reference image. Search category: "${category}".`,
    "The reference image's observable attributes are:",
    JSON.stringify(referenceAttributes),
    "Below is a JSON array of album photos with their attributes.",
    "Score each album photo 0-100 by visual-attribute similarity to the reference,",
    "weighting the attributes relevant to the chosen category (all attributes for",
    "Overall Visual Similarity). Do NOT match people or identity — compare clothing,",
    "colors, objects, and scenery only.",
    "Return JSON: { \"matches\": [ { \"id\": string, \"score\": number,",
    '"rationale": string } ] } for every photo, sorted by score desc.',
    `PHOTOS: ${JSON.stringify(catalog)}`,
  ].join(" ");

  const raw = await callVision(cfg, [{ type: "text", text: instruction }]);
  const parsed = safeParse<{ matches?: unknown }>(raw, { matches: [] });
  return { referenceAttributes, matches: normalizeMatches(parsed.matches) };
}

function normalizeMatches(value: unknown): RankedMatch[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((m) => {
      const obj = m as Record<string, unknown>;
      const score = Number(obj.score);
      return {
        id: String(obj.id ?? ""),
        score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
        rationale: typeof obj.rationale === "string" ? obj.rationale : "",
      };
    })
    .filter((m) => m.id)
    .sort((a, b) => b.score - a.score);
}

export { EMPTY_ATTRIBUTES };
