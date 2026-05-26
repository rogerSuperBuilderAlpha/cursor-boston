import { Submission } from "./types";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_FILE = join(process.cwd(), "submissions.json");

function loadFromDisk(): Map<string, Submission> {
  const map = new Map<string, Submission>();
  if (existsSync(DATA_FILE)) {
    try {
      const raw = readFileSync(DATA_FILE, "utf-8");
      const arr: Submission[] = JSON.parse(raw);
      for (const s of arr) {
        map.set(s.id, s);
      }
    } catch {
      // corrupted file — start fresh
    }
  }
  return map;
}

function saveToDisk(map: Map<string, Submission>): void {
  try {
    const arr = Array.from(map.values());
    writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2));
  } catch {
    // best-effort
  }
}

const globalStore = globalThis as unknown as {
  __jumbotron_store?: Map<string, Submission>;
  __jumbotron_loaded?: boolean;
};

if (!globalStore.__jumbotron_store || !globalStore.__jumbotron_loaded) {
  globalStore.__jumbotron_store = loadFromDisk();
  globalStore.__jumbotron_loaded = true;
}

const store = globalStore.__jumbotron_store;

export function addSubmission(sub: Submission): void {
  store.set(sub.id, sub);
  saveToDisk(store);
}

export function getSubmission(id: string): Submission | undefined {
  return store.get(id);
}

export function updateSubmission(
  id: string,
  patch: Partial<Submission>
): Submission | undefined {
  const existing = store.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  store.set(id, updated);
  saveToDisk(store);
  return updated;
}

export function removeSubmission(id: string): boolean {
  const existed = store.delete(id);
  if (existed) saveToDisk(store);
  return existed;
}

export function getAllSubmissions(): Submission[] {
  return Array.from(store.values()).sort((a, b) => {
    if (b.composite_score !== a.composite_score) {
      return b.composite_score - a.composite_score;
    }
    return b.createdAt - a.createdAt;
  });
}

export function getQueuePosition(id: string): number {
  const all = getAllSubmissions();
  const idx = all.findIndex((s) => s.id === id);
  return idx === -1 ? -1 : idx + 1;
}

export function getApprovedRoastCount(): number {
  return Array.from(store.values()).filter(
    (s) => s.mode === "roast" && s.status === "approved"
  ).length;
}
