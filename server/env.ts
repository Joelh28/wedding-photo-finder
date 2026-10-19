import "dotenv/config";

/**
 * Central place that reads AI configuration from the server environment.
 *
 * SECURITY: the API key is read here, on the server, only. It is never sent to
 * the browser. The client learns *whether* AI is configured via /api/health,
 * but never receives the key itself.
 */
export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function getAiConfig(): AiConfig | null {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return null;

  return {
    apiKey,
    // Defaults target OpenAI. Override AI_BASE_URL / AI_MODEL to use any
    // OpenAI-compatible vision endpoint (e.g. a local gateway, Azure, etc.).
    baseUrl: (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.AI_MODEL?.trim() || "gpt-4o-mini",
  };
}

export const PORT = Number(process.env.PORT) || 8787;
