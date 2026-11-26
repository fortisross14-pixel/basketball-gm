// Club packs (PC Fútbol-editor style): user edits to club identities — name,
// nickname, abbreviation, colours, arena name and logo — keyed by the club's
// ORIGINAL seed name so a pack can be applied to any save or new game.
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { Club, World } from '../engine/types';
import { CLUB_SEEDS } from '../engine/data/clubs';

export interface ClubEdit {
  name?: string;
  nickname?: string;
  abbrev?: string;
  colors?: [string, string];
  arena?: string;
  logoUrl?: string;
}

export interface ClubPack {
  format: 'bd-club-pack';
  version: 1;
  clubs: Record<string, ClubEdit>;
}

const PACK_KEY = 'bd-club-pack';
const AUTO_KEY = 'bd-club-pack-auto';
const SEEDS = new Map(CLUB_SEEDS.map((s) => [s.name, s]));
const HEX = /^#[0-9a-f]{6}$/i;

export const emptyPack = (): ClubPack => ({ format: 'bd-club-pack', version: 1, clubs: {} });
export const seedOf = (c: Club) => c.seedName ?? c.name;
export const packSize = (p: ClubPack | null) => (p ? Object.keys(p.clubs).length : 0);

/** Fields of a club that differ from its seed identity. */
export function clubEditOf(c: Club): ClubEdit {
  const s = SEEDS.get(seedOf(c));
  const e: ClubEdit = {};
  if (!s || c.name !== s.name) e.name = c.name;
  if (!s || c.nickname !== s.nickname) e.nickname = c.nickname;
  if (!s || c.abbrev !== s.abbrev) e.abbrev = c.abbrev;
  if (!s || c.colors[0] !== s.colors[0] || c.colors[1] !== s.colors[1]) e.colors = [c.colors[0], c.colors[1]];
  if (!s || c.arena.name !== s.arena) e.arena = c.arena.name;
  if (c.logoUrl) e.logoUrl = c.logoUrl;
  return e;
}

export const isEdited = (c: Club) => Object.keys(clubEditOf(c)).length > 0;

/** Pack with every edited club of this save. */
export function buildPack(w: World): ClubPack {
  const p = emptyPack();
  for (const c of w.clubs) {
    const e = clubEditOf(c);
    if (Object.keys(e).length) p.clubs[seedOf(c)] = e;
  }
  return p;
}

/** Apply one edit to a club; absent fields are left unchanged, `logoUrl: ''` clears the logo. */
export function applyClubEdit(w: World, c: Club, e: ClubEdit) {
  const oldName = c.name;
  if (e.name) c.name = e.name;
  if (e.nickname != null) c.nickname = e.nickname;
  if (e.abbrev) c.abbrev = e.abbrev;
  if (e.colors) c.colors = [e.colors[0], e.colors[1]];
  if (e.arena) c.arena.name = e.arena;
  if (e.logoUrl !== undefined) {
    if (e.logoUrl) c.logoUrl = e.logoUrl;
    else delete c.logoUrl;
  }
  if (c.name !== oldName) for (const s of w.user.career) if (s.clubId === c.id && s.clubName === oldName) s.clubName = c.name;
}

/** Apply a pack to a world; returns how many clubs matched. */
export function applyPack(w: World, pack: ClubPack): number {
  let n = 0;
  for (const c of w.clubs) {
    const e = pack.clubs[seedOf(c)];
    if (!e) continue;
    applyClubEdit(w, c, e);
    n++;
  }
  return n;
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

export function sanitizeLogoUrl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (/^data:image\/(png|webp|jpeg|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(t) && t.length < 400_000) return t;
  if (/^https?:\/\/\S+$/i.test(t) && t.length < 2000) return t;
  return undefined;
}

function sanitizeEdit(raw: unknown): ClubEdit | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const e: ClubEdit = {};
  const name = str(r.name, 60); if (name) e.name = name;
  if (typeof r.nickname === 'string') e.nickname = r.nickname.trim().slice(0, 60);
  const ab = str(r.abbrev, 3); if (ab) e.abbrev = ab.toUpperCase();
  if (Array.isArray(r.colors) && r.colors.length === 2 && r.colors.every((x) => typeof x === 'string' && HEX.test(x))) e.colors = [r.colors[0] as string, r.colors[1] as string];
  const arena = str(r.arena, 80); if (arena) e.arena = arena;
  const logo = sanitizeLogoUrl(r.logoUrl); if (logo) e.logoUrl = logo;
  return Object.keys(e).length ? e : null;
}

/** Parse and validate a pack file. Throws with a readable message. */
export function parsePack(json: string): ClubPack {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('The file is not valid JSON.'); }
  const clubs = (raw as { clubs?: unknown })?.clubs;
  if ((raw as { format?: unknown })?.format !== 'bd-club-pack' || !clubs || typeof clubs !== 'object') throw new Error('Not a Basketball Dynasty club pack.');
  const p = emptyPack();
  for (const [k, v] of Object.entries(clubs as Record<string, unknown>)) {
    const e = sanitizeEdit(v);
    if (e) p.clubs[k] = e;
  }
  return p;
}

export function downloadPack(pack: ClubPack, filename = 'club-pack.json') {
  const blob = new Blob([JSON.stringify(pack, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------------------------------------------------------------------
// Global pack (IndexedDB), applied automatically to new games
// ---------------------------------------------------------------------------
export async function loadStoredPack(): Promise<ClubPack | null> {
  try {
    const p = await idbGet(PACK_KEY);
    return typeof p === 'string' ? parsePack(p) : null;
  } catch { return null; }
}

export async function storePack(p: ClubPack | null) {
  try {
    if (!p || !packSize(p)) await idbDel(PACK_KEY);
    else await idbSet(PACK_KEY, JSON.stringify(p));
  } catch { /* storage unavailable: pack only lives in this save */ }
}

/** Merge club entries into the stored pack (a club's entry is replaced as a whole; an empty edit removes it). */
export async function mergeIntoStoredPack(entries: Record<string, ClubEdit>) {
  const p = (await loadStoredPack()) ?? emptyPack();
  for (const [k, e] of Object.entries(entries)) {
    if (Object.keys(e).length) p.clubs[k] = e;
    else delete p.clubs[k];
  }
  await storePack(p);
}

export async function getAutoApply(): Promise<boolean> {
  try { return (await idbGet(AUTO_KEY)) !== false; } catch { return true; }
}

export async function setAutoApply(on: boolean) {
  try { await idbSet(AUTO_KEY, on); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Logo images
// ---------------------------------------------------------------------------
/** Downscale an uploaded image to fit in max×max px and return a compact data URL (WebP, PNG fallback). */
export async function imageFileToDataUrl(file: File, max = 160): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('That file is not an image the browser can read.'));
      i.src = src;
    });
    const w0 = img.naturalWidth || max, h0 = img.naturalHeight || max;
    const k = Math.min(1, max / Math.max(w0, h0));
    const cw = Math.max(1, Math.round(w0 * k)), ch = Math.max(1, Math.round(h0 * k));
    const cv = document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    const ctx = cv.getContext('2d');
    if (!ctx) throw new Error('Canvas not available.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, cw, ch);
    const webp = cv.toDataURL('image/webp', 0.86);
    const png = cv.toDataURL('image/png');
    return webp.startsWith('data:image/webp') && webp.length < png.length ? webp : png;
  } finally {
    URL.revokeObjectURL(src);
  }
}
