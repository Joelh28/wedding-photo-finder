import "dotenv/config";

/**
 * Central place that reads AI configuration from the server environment.
 *
 * Supports both Gemini (standard in AI Studio Build) and OpenAI/compatible
 * vision endpoints.
 */
export interface AiConfig {
  provider: "gemini" | "openai";
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export function getAiConfig(): AiConfig | null {
  // Check Gemini first (provided by AI Studio Build or user .env)
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    return {
      provider: "gemini",
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
    };
  }

  // Fallback to OpenAI / compatible endpoint if AI_API_KEY is provided
  const apiKey = process.env.AI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    return {
      provider: "openai",
      apiKey,
      baseUrl: (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, ""),
      model: process.env.AI_MODEL?.trim() || "gpt-4o-mini",
    };
  }

  return null;
}

export const PORT = Number(process.env.PORT) || 3000;
