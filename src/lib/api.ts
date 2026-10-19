import type { PhotoAttributes, RankedMatch } from "../types";

/** Client for the thin backend proxy. The browser never talks to the AI vendor directly. */

export interface HealthResponse {
  aiConfigured: boolean;
  model: string | null;
}

async function asError(res: Response): Promise<never> {
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error === "AI_NOT_CONFIGURED") {
      message = "AI is not configured on the server. See README to add an API key.";
    } else if (body.error) {
      message = body.error;
    }
  } catch {
    /* ignore */
  }
  throw new Error(message);
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) return asError(res);
  return (await res.json()) as HealthResponse;
}

export async function analyzePhoto(imageDataUrl: string): Promise<PhotoAttributes> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl }),
  });
  if (!res.ok) return asError(res);
  const data = (await res.json()) as { attributes: PhotoAttributes };
  return data.attributes;
}

export async function searchByText(
  query: string,
  category: string,
  photos: { id: string; attributes: PhotoAttributes }[],
): Promise<RankedMatch[]> {
  const res = await fetch("/api/search/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, category, photos }),
  });
  if (!res.ok) return asError(res);
  const data = (await res.json()) as { matches: RankedMatch[] };
  return data.matches;
}

export async function searchByReference(
  referenceDataUrl: string,
  category: string,
  photos: { id: string; attributes: PhotoAttributes }[],
): Promise<{ referenceAttributes: PhotoAttributes; matches: RankedMatch[] }> {
  const res = await fetch("/api/search/reference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ referenceDataUrl, category, photos }),
  });
  if (!res.ok) return asError(res);
  return (await res.json()) as {
    referenceAttributes: PhotoAttributes;
    matches: RankedMatch[];
  };
}
