/**
 * Minimal IndexedDB wrapper — one object store, get/put/delete by key.
 *
 * Why IndexedDB and not localStorage: the vault holds full prompt drafts and
 * orchestra runs, which blow past localStorage's ~5MB ceiling quickly, and
 * localStorage writes are synchronous on the main thread. We store exactly one
 * record (the whole vault, encrypted as a single envelope), so we need none of
 * IndexedDB's indexing — hence this ~60-line wrapper instead of a dependency.
 */

const DB_NAME = "prompt-composer";
const DB_VERSION = 1;
const STORE = "vault";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable (private mode or unsupported browser)."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    // Another tab is holding an older version open.
    req.onblocked = () => reject(new Error("IndexedDB blocked by another tab."));
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
      })
  );
}

export function idbGet<T>(key: string): Promise<T | undefined> {
  return tx<T | undefined>("readonly", (s) => s.get(key));
}

export function idbPut(key: string, value: unknown): Promise<void> {
  return tx<void>("readwrite", (s) => s.put(value, key)).then(() => undefined);
}

export function idbDelete(key: string): Promise<void> {
  return tx<void>("readwrite", (s) => s.delete(key)).then(() => undefined);
}

/** Wipe everything. Backs the "Delete all local data" control in Settings. */
export function idbClear(): Promise<void> {
  return tx<void>("readwrite", (s) => s.clear()).then(() => undefined);
}
