import type { PhotoAttributes, RankedMatch } from "../types";

/** Client for the backend proxy. The browser never talks to the AI vendor directly. */

export interface HealthResponse {
  aiConfigured: boolean;
  visionModel?: string | null;
  textModel?: string | null;
  model: string | null;
  provider?: string | null;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!isJson) {
    const text = await res.text().catch(() => "");
    // Check for Nginx warmup/gateway or auth redirects
    if (text.includes("warmup") || text.includes("Starting") || res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error("Server is temporarily starting up or warming up. Please try again in a few seconds.");
    }
    if (text.includes("cookie_check") || text.includes("auth")) {
      throw new Error("Session is authenticating. Please try again in a moment.");
    }
    throw new Error(
      `Server returned an unexpected response (${res.status} ${contentType || "HTML"}). Please try again.`
    );
  }

  const data = (await res.json()) as any;
  if (!res.ok) {
    let errorMsg = `Request failed (${res.status})`;
    if (data?.error) {
      if (data.error === "AI_NOT_CONFIGURED") {
        errorMsg = "Gemini AI is not configured on the server. Please check environment configuration.";
      } else {
        errorMsg = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
      }
    }
    throw new Error(errorMsg);
  }

  return data as T;
}

export async function getHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    return await handleResponse<HealthResponse>(res);
  } catch (err) {
    // Retry once in case of initial container warmup
    await new Promise((r) => setTimeout(r, 800));
    const res2 = await fetch("/api/health", { cache: "no-store" });
    return await handleResponse<HealthResponse>(res2);
  }
}

export async function analyzePhoto(imageDataUrl: string): Promise<PhotoAttributes> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl }),
  });
  const data = await handleResponse<{ attributes: PhotoAttributes }>(res);
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
  const data = await handleResponse<{ matches: RankedMatch[] }>(res);
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
  return handleResponse<{
    referenceAttributes: PhotoAttributes;
    matches: RankedMatch[];
  }>(res);
}
