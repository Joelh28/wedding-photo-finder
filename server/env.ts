import "dotenv/config";

/**
 * Central place that reads AI configuration from the server environment.
 *
 * Vision Model: Gemini 3.6 Flash (gemini-3.6-flash) for photo visual attribute extraction
 * Text Ranking Model: Gemini 3.1 Flash Lite (gemini-3.1-flash-lite) for text search & ranking
 * Optional Fallback: OpenAI-compatible endpoint (via AI_API_KEY)
 */
export interface AiConfig {
  provider: "gemini" | "openai";
  apiKey: string;
  baseUrl?: string;
  visionModel: string;
  textModel: string;
  /** Primary identifier for backward-compatible logs and client checks */
  model: string;
}

export function getAiConfig(): AiConfig | null {
  // Primary: Google Gemini API (automatically provided in Google AI Studio)
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    const visionModel = process.env.GEMINI_VISION_MODEL?.trim() || "gemini-3.6-flash";
    const textModel = process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-3.1-flash-lite";
    return {
      provider: "gemini",
      apiKey: geminiKey,
      visionModel,
      textModel,
      model: `${visionModel} (vision) / ${textModel} (search)`,
    };
  }

  // Optional fallback: OpenAI-compatible vision endpoint
  const apiKey = process.env.AI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";
    return {
      provider: "openai",
      apiKey,
      baseUrl: (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, ""),
      visionModel: model,
      textModel: model,
      model,
    };
  }

  return null;
}

export const PORT = Number(process.env.PORT) || 3000;
