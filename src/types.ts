export interface PhotoAttributes {
  summary: string;
  outfitClothing: string[];
  objectsAccessories: string[];
  backgroundLocation: string[];
  colors: string[];
  sceneType: string;
}

export interface DetectedFace {
  id: string;
  box: { x: number; y: number; width: number; height: number };
  descriptor: number[]; // 128-dimensional facial geometry vector
}

export interface StoredPhoto {
  id: string;
  name: string;
  type: string;
  size: number;
  addedAt: number;
  dataUrl: string;
  /** Cached observable-attribute analysis, if the photo has been analyzed. */
  attributes?: PhotoAttributes;
  /** Cached facial embeddings if face recognition was performed. */
  faces?: DetectedFace[];
}

export type SearchCategory =
  | "Outfit & Clothing"
  | "Objects & Accessories"
  | "Background & Location"
  | "Overall Visual Similarity";

export const SEARCH_CATEGORIES: SearchCategory[] = [
  "Outfit & Clothing",
  "Objects & Accessories",
  "Background & Location",
  "Overall Visual Similarity",
];

export interface RankedMatch {
  id: string;
  score: number;
  rationale: string;
  matchType?: "attribute" | "face";
}
