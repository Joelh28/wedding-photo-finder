import * as faceapi from "@vladmandic/face-api";
import type { DetectedFace, RankedMatch, StoredPhoto } from "../types";

let modelsLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * Loads the face-api models from the local /models/ directory.
 * Models run 100% locally in the browser via WebGL / WebAssembly.
 * No data is ever transmitted to external servers.
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const MODEL_URL = "/models";
    // Load SSD MobileNet V1 face detector for high accuracy in wedding scenes
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    // Load 68-point facial landmark alignment model
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    // Load 128-D facial recognition embedding model
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    modelsLoaded = true;
  })();

  return loadPromise;
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

/** Helper to convert image dataUrl into an HTMLImageElement */
export function createImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for face detection."));
    img.src = dataUrl;
  });
}

/**
 * Detects all faces in an image and computes their 128-D facial embeddings.
 * Supports multi-person group photos.
 */
export async function detectFacesInImage(dataUrl: string): Promise<DetectedFace[]> {
  await loadFaceModels();
  const img = await createImageFromDataUrl(dataUrl);

  // SsdMobileNetV1Options with minConfidence 0.45 captures faces in group photos
  const detections = await faceapi
    .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections.map((d, index) => {
    const box = d.detection.box;
    return {
      id: `face-${index}-${Math.round(box.x)}-${Math.round(box.y)}`,
      box: {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      },
      descriptor: Array.from(d.descriptor),
    };
  });
}

/**
 * Calculates Euclidean distance and estimated facial similarity percentage.
 * Note: Displayed as an estimated matching score, not a proof of identity.
 */
export function calculateFaceSimilarity(
  refDescriptor: number[],
  targetDescriptor: number[],
): { distance: number; score: number } {
  const ref = new Float32Array(refDescriptor);
  const target = new Float32Array(targetDescriptor);
  const distance = faceapi.euclideanDistance(ref, target);

  // Distance calibration for Face Recognition ResNet:
  // <= 0.40 -> ~90-100% high match
  // 0.41 - 0.55 -> ~70-89% moderate match
  // 0.56 - 0.65 -> ~50-69% weak match
  // > 0.70 -> ~0-30% low/no match
  const score = Math.max(0, Math.min(100, Math.round((1 - distance / 0.72) * 100)));

  return { distance, score };
}

/**
 * Matches a selected reference face descriptor against all photos in the album.
 * For group photos with multiple people, matches against the closest face.
 */
export function rankPhotosByFace(
  referenceDescriptor: number[],
  photos: StoredPhoto[],
  minThreshold = 40,
): RankedMatch[] {
  const matches: RankedMatch[] = [];

  for (const photo of photos) {
    if (!photo.faces || photo.faces.length === 0) {
      // Photo had no faces detected
      continue;
    }

    let bestScore = 0;
    let bestDistance = 999;
    const totalFacesInPhoto = photo.faces.length;

    for (const face of photo.faces) {
      const { distance, score } = calculateFaceSimilarity(referenceDescriptor, face.descriptor);
      if (score > bestScore) {
        bestScore = score;
        bestDistance = distance;
      }
    }

    if (bestScore >= minThreshold) {
      const confidenceLabel =
        bestScore >= 80 ? "High match" : bestScore >= 60 ? "Moderate match" : "Possible match";
      const groupDetail =
        totalFacesInPhoto > 1
          ? ` (matched 1 of ${totalFacesInPhoto} people in photo)`
          : "";

      matches.push({
        id: photo.id,
        score: bestScore,
        rationale: `${confidenceLabel}${groupDetail}. Estimated facial similarity: ${bestScore}% (distance: ${bestDistance.toFixed(2)}).`,
        matchType: "face",
      });
    }
  }

  // Sort descending by facial match score
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Utility to extract a cropped data URL of a detected face from a source image
 * for previewing in the face selector.
 */
export async function cropFacePreview(
  dataUrl: string,
  box: { x: number; y: number; width: number; height: number },
  padding = 0.25,
): Promise<string> {
  const img = await createImageFromDataUrl(dataUrl);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  const padX = box.width * padding;
  const padY = box.height * padding;

  const cropX = Math.max(0, box.x - padX);
  const cropY = Math.max(0, box.y - padY);
  const cropW = Math.min(img.width - cropX, box.width + padX * 2);
  const cropH = Math.min(img.height - cropY, box.height + padY * 2);

  canvas.width = 120;
  canvas.height = 120;
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 120, 120);

  return canvas.toDataURL("image/jpeg", 0.9);
}
