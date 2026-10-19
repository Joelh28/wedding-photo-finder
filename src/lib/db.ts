import type { PhotoAttributes, StoredPhoto } from "../types";

/**
 * Tiny IndexedDB wrapper — photos live only in the browser (no database,
 * no accounts). One object store keyed by photo id.
 */
const DB_NAME = "wedding-photo-finder";
const STORE = "photos";
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export async function getAllPhotos(): Promise<StoredPhoto[]> {
  const all = await tx<StoredPhoto[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => a.addedAt - b.addedAt);
}

export async function putPhoto(photo: StoredPhoto): Promise<void> {
  await tx("readwrite", (s) => s.put(photo));
}

export async function putPhotos(photos: StoredPhoto[]): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite");
    const store = t.objectStore(STORE);
    photos.forEach((p) => store.put(p));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  db.close();
}

export async function deletePhoto(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export async function clearAll(): Promise<void> {
  await tx("readwrite", (s) => s.clear());
}

export async function setAttributes(
  id: string,
  attributes: PhotoAttributes,
): Promise<void> {
  const existing = await tx<StoredPhoto | undefined>("readonly", (s) => s.get(id));
  if (!existing) return;
  await putPhoto({ ...existing, attributes });
}
