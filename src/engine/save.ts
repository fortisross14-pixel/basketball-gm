import type { World } from './types';
import { SAVE_VERSION } from './worldgen';
import { invalidateIndex, club } from './world';
import { seasonLabel, fmtDate } from './calendar';

export interface SaveMeta {
  id: string;
  name: string;
  clubName: string;
  season: string;
  date: string;
  updated: number;
  version: number;
  auto: boolean;
}

/** Ordered migrations: index i upgrades a save from version i+1 to i+2. */
const MIGRATIONS: ((w: World) => void)[] = [];

export function migrate(w: World): World {
  let v = w.version ?? 1;
  while (v < SAVE_VERSION) {
    MIGRATIONS[v - 1]?.(w);
    v++;
  }
  w.version = SAVE_VERSION;
  w.pendingMoves ??= [];
  w.pendingHolds ??= [];
  invalidateIndex(w);
  return w;
}

export function serialize(w: World): string {
  return JSON.stringify(w);
}

export function deserialize(json: string): World {
  const w = JSON.parse(json) as World;
  if (!w || typeof w !== 'object' || !Array.isArray(w.clubs) || !Array.isArray(w.players)) throw new Error('Not a Basketball Dynasty save file.');
  return migrate(w);
}

export function metaOf(w: World, auto = false): SaveMeta {
  const c = w.user.clubId != null ? club(w, w.user.clubId) : null;
  return {
    id: w.saveId,
    name: w.saveName || `${w.user.name} — ${c?.name ?? 'Unemployed'}`,
    clubName: c?.name ?? 'Unemployed',
    season: seasonLabel(w.season),
    date: fmtDate(w.season, w.day, false),
    updated: Date.now(),
    version: w.version,
    auto,
  };
}

// ---------------------------------------------------------------------------
// Storage backend (IndexedDB via idb-keyval in the browser; memory in tests)
// ---------------------------------------------------------------------------
interface Backend {
  get(key: string): Promise<unknown>;
  set(key: string, val: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

let backend: Backend | null = null;

async function getBackend(): Promise<Backend> {
  if (backend) return backend;
  if (typeof indexedDB !== 'undefined') {
    const idb = await import('idb-keyval');
    backend = { get: (k) => idb.get(k), set: (k, v) => idb.set(k, v), del: (k) => idb.del(k) };
  } else {
    const mem = new Map<string, unknown>();
    backend = { get: async (k) => mem.get(k), set: async (k, v) => void mem.set(k, v), del: async (k) => void mem.delete(k) };
  }
  return backend;
}

const INDEX_KEY = 'bd-save-index';

export async function listSaves(): Promise<SaveMeta[]> {
  const b = await getBackend();
  const idx = ((await b.get(INDEX_KEY)) as SaveMeta[] | undefined) ?? [];
  return idx.sort((a, b2) => b2.updated - a.updated);
}

export async function saveWorld(w: World, auto = false): Promise<SaveMeta> {
  const b = await getBackend();
  const meta = metaOf(w, auto);
  // rolling backup of the previous version (kept before each autosave)
  const idx = ((await b.get(INDEX_KEY)) as SaveMeta[] | undefined) ?? [];
  if (auto && idx.some((m) => m.id === meta.id)) {
    const prev = await b.get(`bd-save-${w.saveId}`);
    if (prev) await b.set(`bd-backup-${w.saveId}`, prev);
  }
  await b.set(`bd-save-${w.saveId}`, serialize(w));
  const next = [meta, ...idx.filter((m) => m.id !== meta.id)];
  await b.set(INDEX_KEY, next);
  return meta;
}

export async function loadWorld(id: string): Promise<World | null> {
  const b = await getBackend();
  const json = (await b.get(`bd-save-${id}`)) as string | undefined;
  if (!json) return null;
  return deserialize(json);
}

export async function deleteSave(id: string): Promise<void> {
  const b = await getBackend();
  await b.del(`bd-save-${id}`);
  await b.del(`bd-backup-${id}`);
  const idx = ((await b.get(INDEX_KEY)) as SaveMeta[] | undefined) ?? [];
  await b.set(INDEX_KEY, idx.filter((m) => m.id !== id));
}
