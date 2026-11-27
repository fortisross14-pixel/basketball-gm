import type { World } from './types';
import { SAVE_VERSION } from './worldgen';
import { invalidateIndex, club } from './world';
import { ensureShop } from './shop';
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
const MIGRATIONS: ((w: World) => void)[] = [
  // v1 → v2: career profile, owner/fan evaluation, US college league
  (w) => {
    w.user.nationality ??= 'ESP';
    w.user.background ??= 'business';
    w.user.approval ??= { board: w.user.clubId != null ? w.clubs.find((c) => c.id === w.user.clubId)?.board.overall ?? 60 : 60, fans: 55, fanBonus: 0, lowFanWeeks: 0, history: [], notes: [] };
    for (const id of Object.keys(w.rules.leagues)) {
      const l = w.rules.leagues[id as keyof typeof w.rules.leagues] as World['rules']['leagues']['ELITE'];
      l.kind ??= 'pro';
      l.country ??= 'ESP';
    }
  },
  // v2 → v3: playable shop & food for the user's club (stock seeded from the forecast)
  () => { /* shop is created after the index rebuild below */ },
];

export class SaveError extends Error {}

export function migrate(w: World): World {
  let v = w.version ?? 1;
  if (v > SAVE_VERSION) throw new SaveError(`This save was made by a newer version of the game (save v${v}, game v${SAVE_VERSION}). Update the game to load it.`);
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v - 1];
    if (!step) throw new SaveError(`No migration from save v${v} to v${v + 1}.`);
    step(w);
    v++;
  }
  w.version = SAVE_VERSION;
  renameCompetitions(w);
  w.pendingMoves ??= [];
  w.pendingHolds ??= [];
  for (const c of w.clubs) c.seedName ??= c.name;
  validate(w);
  invalidateIndex(w);
  const uc = w.user.clubId != null ? w.clubs.find((x) => x.id === w.user.clubId) : undefined;
  if (uc && !uc.foreign) ensureShop(w, uc);
  return w;
}

/** Real competition names (older saves used invented ones). Idempotent. */
const OLD_NAMES: [RegExp, string][] = [
  [/Liga Élite/g, 'Liga ACB'], [/Liga Oro/g, 'Primera FEB'], [/Liga Plata/g, 'Segunda FEB'], [/Continental Cup/g, 'EuroCup'],
  [/National Collegiate League/g, 'NCAA Division I'], [/\bNCL\b/g, 'NCAA'], [/\bCopa\b(?! del Rey)/g, 'Copa del Rey'],
];
function renameCompetitions(w: World) {
  const L = w.rules.leagues;
  if (L.ELITE?.name === 'Liga ACB') return;
  const fix = (t: string) => OLD_NAMES.reduce((a, [re, to]) => a.replace(re, to), t);
  const shorts: Record<string, string> = { ELITE: 'ACB', ORO: 'Primera FEB', PLATA: 'Segunda FEB', COLLEGE: 'NCAA' };
  for (const [id, l] of Object.entries(L)) { l.name = fix(l.name); if (shorts[id]) l.short = shorts[id]; }
  for (const c of w.competitions) c.name = fix(c.name);
  for (const f of w.fixtures) f.label = fix(f.label.replace(/^(Élite|Oro|Plata|NCL) · /, (_, s: string) => `${({ Élite: 'ACB', Oro: 'Primera FEB', Plata: 'Segunda FEB', NCL: 'NCAA' } as Record<string, string>)[s]} · `));
  for (const c of w.clubs) for (const t of c.trophies) t.name = fix(t.name);
  for (const s of w.staff) for (const r of s.record ?? []) { r.league = fix(r.league); r.honours = r.honours.map(fix); }
  for (const n of w.news) { n.headline = fix(n.headline); n.body = fix(n.body); }
}

/** Structural validation: required collections, resolvable references, no NaN money. */
export function validate(w: World) {
  const fail = (m: string) => { throw new SaveError(`Save file is damaged: ${m}`); };
  for (const k of ['clubs', 'players', 'staff', 'fixtures', 'competitions', 'news', 'decisions'] as const) if (!Array.isArray(w[k])) fail(`missing ${k}`);
  if (typeof w.season !== 'number' || typeof w.day !== 'number') fail('missing date');
  const clubIds = new Set(w.clubs.map((c) => c.id));
  if (w.user.clubId != null && !clubIds.has(w.user.clubId)) fail('your club no longer exists');
  for (const c of w.clubs) if (!Number.isFinite(c.finances.cash)) fail(`${c.name} has invalid cash`);
  for (const p of w.players) if (p.teamId != null && !clubIds.has(p.teamId)) fail(`player ${p.id} belongs to an unknown club`);
  for (const f of w.fixtures) if (!clubIds.has(f.homeId) || !clubIds.has(f.awayId)) fail(`fixture ${f.id} references an unknown club`);
}

export function serialize(w: World): string {
  return JSON.stringify({ ...w, savedAt: Date.now() });
}

export function deserialize(json: string): World {
  let w: World;
  try {
    w = JSON.parse(json) as World;
  } catch {
    throw new SaveError('The file is not valid JSON (it may be truncated).');
  }
  if (!w || typeof w !== 'object' || !Array.isArray(w.clubs) || !Array.isArray(w.players)) throw new SaveError('Not a Basketball Dynasty save file.');
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
  setMany(entries: [string, unknown][]): Promise<void>;
  del(key: string): Promise<void>;
}

let backend: Backend | null = null;

async function getBackend(): Promise<Backend> {
  if (backend) return backend;
  if (typeof indexedDB !== 'undefined') {
    const idb = await import('idb-keyval');
    // ask the browser not to evict saves under storage pressure
    try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
    backend = { get: (k) => idb.get(k), setMany: (e) => idb.setMany(e), del: (k) => idb.del(k) };
  } else {
    const mem = new Map<string, unknown>();
    backend = { get: async (k) => mem.get(k), setMany: async (e) => { for (const [k, v] of e) mem.set(k, v); }, del: async (k) => void mem.delete(k) };
  }
  return backend;
}

const INDEX_KEY = 'bd-save-index';

export async function listSaves(): Promise<SaveMeta[]> {
  const b = await getBackend();
  const idx = ((await b.get(INDEX_KEY)) as SaveMeta[] | undefined) ?? [];
  return idx.sort((a, b2) => b2.updated - a.updated);
}

/**
 * Save data, rolling backup and index in a single IndexedDB transaction, so a
 * tab closed mid-save leaves either the old or the new state — never a mix.
 */
export async function saveWorld(w: World, auto = false): Promise<SaveMeta> {
  const b = await getBackend();
  const meta = metaOf(w, auto);
  const idx = ((await b.get(INDEX_KEY)) as SaveMeta[] | undefined) ?? [];
  const entries: [string, unknown][] = [];
  if (auto && idx.some((m) => m.id === meta.id)) {
    const prev = await b.get(`bd-save-${w.saveId}`);
    if (prev) entries.push([`bd-backup-${w.saveId}`, prev]);
  }
  entries.push([`bd-save-${w.saveId}`, serialize(w)]);
  entries.push([INDEX_KEY, [meta, ...idx.filter((m) => m.id !== meta.id)]]);
  try {
    await b.setMany(entries);
  } catch (e) {
    if ((e as Error).name === 'QuotaExceededError') throw new SaveError('Browser storage is full. Delete old careers or export this one to a file.');
    throw e;
  }
  return meta;
}

export interface LoadResult {
  world: World;
  fromBackup: boolean;
  warning?: string;
}

/** Load a slot; if the main copy is damaged, fall back to the rolling backup. */
export async function loadWorld(id: string): Promise<LoadResult | null> {
  const b = await getBackend();
  const json = (await b.get(`bd-save-${id}`)) as string | undefined;
  if (json) {
    try {
      return { world: deserialize(json), fromBackup: false };
    } catch (e) {
      if (e instanceof SaveError && /newer version/.test(e.message)) throw e;
      const backup = (await b.get(`bd-backup-${id}`)) as string | undefined;
      if (!backup) throw e;
      return { world: deserialize(backup), fromBackup: true, warning: `The latest save was damaged (${(e as Error).message}); loaded the previous autosave instead.` };
    }
  }
  const backup = (await b.get(`bd-backup-${id}`)) as string | undefined;
  return backup ? { world: deserialize(backup), fromBackup: true, warning: 'Main save missing; loaded the backup.' } : null;
}

export async function hasBackup(id: string): Promise<boolean> {
  const b = await getBackend();
  return !!(await b.get(`bd-backup-${id}`));
}

/** Explicitly restore the previous autosave. */
export async function loadBackup(id: string): Promise<World | null> {
  const b = await getBackend();
  const backup = (await b.get(`bd-backup-${id}`)) as string | undefined;
  return backup ? deserialize(backup) : null;
}

/** An imported file gets a fresh slot if its id is already in use, and is persisted immediately. */
export async function importWorld(json: string): Promise<World> {
  const w = deserialize(json);
  const idx = await listSaves();
  if (idx.some((m) => m.id === w.saveId)) {
    w.saveId = `${w.saveId}-import-${Date.now().toString(36)}`;
    w.saveName = `${w.saveName || metaOf(w).name} (imported)`;
  }
  await saveWorld(w, false);
  return w;
}

export async function deleteSave(id: string): Promise<void> {
  const b = await getBackend();
  await b.del(`bd-save-${id}`);
  await b.del(`bd-backup-${id}`);
  const idx = ((await b.get(INDEX_KEY)) as SaveMeta[] | undefined) ?? [];
  await b.setMany([[INDEX_KEY, idx.filter((m) => m.id !== id)]]);
}
