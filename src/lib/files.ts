import type { StoredPhoto } from "../types";

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return reject(new Error(`File "${file.name}" is not a recognized image.`));
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read file "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Convert selected image files into StoredPhoto records (non-images are skipped). */
export async function filesToStoredPhotos(files: FileList | File[]): Promise<StoredPhoto[]> {
  const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
  return Promise.all(
    list.map(async (file) => ({
      id: uid(),
      name: file.name,
      type: file.type,
      size: file.size,
      addedAt: Date.now(),
      dataUrl: await fileToDataUrl(file),
    })),
  );
}

/**
 * Resizes and compresses an image data URL for Gemini visual attribute extraction.
 *
 * Requirements satisfied:
 * - Resizes maximum dimension to approximately 1024px preserving aspect ratio.
 * - Compresses to JPEG (0.85 quality), reducing 15MB+ camera payloads to ~150-250KB.
 * - Does NOT alter the original high-resolution photo stored in IndexedDB.
 * - Handles corrupt or unsupported formats gracefully with clear errors.
 */
export async function prepareImageForAnalysis(dataUrl: string, maxDim = 1024): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    throw new Error("Invalid image format provided for visual analysis.");
  }

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        let { width, height } = img;
        if (width === 0 || height === 0) {
          return reject(new Error("Image has invalid or empty dimensions (0x0)."));
        }

        // Calculate aspect-ratio preserved dimensions constrained to maxDim (1024px)
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(dataUrl);
        }

        // Render resized image to canvas and export as compact JPEG
        ctx.drawImage(img, 0, 0, width, height);
        const compressedJpeg = canvas.toDataURL("image/jpeg", 0.85);
        resolve(compressedJpeg);
      } catch (err) {
        reject(
          new Error(
            `Failed to optimize image for AI analysis: ${
              err instanceof Error ? err.message : "Unknown error"
            }`,
          ),
        );
      }
    };

    img.onerror = () => {
      reject(
        new Error(
          "Unsupported or corrupt image file. Please ensure photos are valid JPEG, PNG, or WebP files.",
        ),
      );
    };

    img.src = dataUrl;
  });
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename || "photo";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
