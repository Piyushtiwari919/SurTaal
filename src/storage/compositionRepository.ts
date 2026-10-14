import { Composition } from "../features/studio/compositionTypes";

const DB_NAME = "surtaal_db";
const DB_VERSION = 1;
const STORE_NAME = "compositions";
const FALLBACK_KEY = "surtaal_compositions_fallback_v1";

export const STARTER_DEMO_COMPOSITION: Composition = {
  schemaVersion: 1,
  id: "starter-pahadi-dhun",
  title: "Evening Mehfil Dhun (Starter Melody)",
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
  tonic: 1,
  bpm: 96,
  notes: [
    {
      id: "d1",
      midi: 61,
      relativeOffset: 0,
      startTimeMs: 0,
      durationMs: 500,
      velocity: 0.9,
    },
    {
      id: "d2",
      midi: 63,
      relativeOffset: 2,
      startTimeMs: 500,
      durationMs: 500,
      velocity: 0.9,
    },
    {
      id: "d3",
      midi: 65,
      relativeOffset: 4,
      startTimeMs: 1000,
      durationMs: 700,
      velocity: 0.95,
    },
    {
      id: "d4",
      midi: 68,
      relativeOffset: 7,
      startTimeMs: 1700,
      durationMs: 700,
      velocity: 0.95,
    },
    {
      id: "d5",
      midi: 70,
      relativeOffset: 9,
      startTimeMs: 2400,
      durationMs: 500,
      velocity: 0.9,
    },
    {
      id: "d6",
      midi: 68,
      relativeOffset: 7,
      startTimeMs: 2900,
      durationMs: 500,
      velocity: 0.9,
    },
    {
      id: "d7",
      midi: 65,
      relativeOffset: 4,
      startTimeMs: 3400,
      durationMs: 500,
      velocity: 0.9,
    },
    {
      id: "d8",
      midi: 63,
      relativeOffset: 2,
      startTimeMs: 3900,
      durationMs: 500,
      velocity: 0.9,
    },
    {
      id: "d9",
      midi: 61,
      relativeOffset: 0,
      startTimeMs: 4400,
      durationMs: 1100,
      velocity: 0.95,
    },
  ],
};

export interface CompositionRepository {
  listAll(): Promise<Composition[]>;
  save(composition: Composition): Promise<void>;
  remove(id: string): Promise<void>;
}

class BrowserCompositionRepository implements CompositionRepository {
  private openDb(): Promise<IDBDatabase | null> {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async listAll(): Promise<Composition[]> {
    const db = await this.openDb();
    if (!db) {
      return this.listFallback();
    }
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as Composition[]) || [];
        if (items.length === 0) {
          resolve([STARTER_DEMO_COMPOSITION]);
        } else {
          resolve(items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        }
      };
      req.onerror = () => resolve(this.listFallback());
    });
  }

  public async save(composition: Composition): Promise<void> {
    this.saveFallback(composition);
    const db = await this.openDb();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(composition);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  public async remove(id: string): Promise<void> {
    this.removeFallback(id);
    const db = await this.openDb();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  private listFallback(): Composition[] {
    try {
      const raw = window.localStorage.getItem(FALLBACK_KEY);
      if (!raw) return [STARTER_DEMO_COMPOSITION];
      const parsed = JSON.parse(raw) as Composition[];
      return parsed.length > 0 ? parsed : [STARTER_DEMO_COMPOSITION];
    } catch {
      return [STARTER_DEMO_COMPOSITION];
    }
  }

  private saveFallback(composition: Composition): void {
    try {
      const all = this.listFallback().filter((c) => c.id !== composition.id);
      all.unshift(composition);
      window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(all));
    } catch {
      // Ignore storage quota errors
    }
  }

  private removeFallback(id: string): void {
    try {
      const filtered = this.listFallback().filter((c) => c.id !== id);
      window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(filtered));
    } catch {
      // Ignore
    }
  }
}

export const compositionRepository: CompositionRepository =
  new BrowserCompositionRepository();
