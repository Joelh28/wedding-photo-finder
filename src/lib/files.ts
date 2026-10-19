import type { StoredPhoto } from "../types";

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
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

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename || "photo";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
