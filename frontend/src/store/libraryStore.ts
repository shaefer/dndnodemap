import { create } from "zustand";
import type { GenerationParams, SavedEntry } from "../types/map";

const STORAGE_KEY = "overworld-library";

// localStorage is unavailable in the Vitest ("node") test environment and may
// throw in private-browsing contexts — persistence is a convenience, never a
// correctness requirement, so every access is best-effort.
function loadEntries(): SavedEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedEntry[]) : [];
  } catch {
    return [];
  }
}

function persistEntries(entries: SavedEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore — see loadEntries comment
  }
}

interface LibraryState {
  entries: SavedEntry[];
  // A SavedEntry stores the seed + params, not the map itself (spec Section
  // 3a) — loading one means regenerating via generateMap(), which only
  // reproduces the original output if the map was never hand-edited after
  // generation.
  save: (name: string, seed: number, params: GenerationParams, algorithmVersion: string, thumbnail?: string) => void;
  remove: (id: string) => void;
}

// LibraryPanel.tsx (M6) is the first UI consumer of this store — it's built
// now, ahead of that panel, per the same "full store, UI catches up later"
// pattern as mapStore's edit actions (see CLAUDE.md's M4 notes).
export const useLibraryStore = create<LibraryState>((set, get) => ({
  entries: loadEntries(),

  save: (name, seed, params, algorithmVersion, thumbnail) => {
    const entry: SavedEntry = {
      id: crypto.randomUUID(),
      name,
      seed,
      algorithmVersion,
      params,
      createdAt: new Date().toISOString(),
      ...(thumbnail ? { thumbnail } : {}),
    };
    const entries = [...get().entries, entry];
    persistEntries(entries);
    set({ entries });
  },

  remove: (id) => {
    const entries = get().entries.filter((e) => e.id !== id);
    persistEntries(entries);
    set({ entries });
  },
}));
