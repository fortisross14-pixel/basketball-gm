// Grid art sheets (docs/ART_REQUEST.md). Each sheet is 2048 × 1024, cut into equal cells.
// Sheets with a "-map" companion are tinted by the game: red = club main colour,
// green = club second colour, blue = skin. Missing sheets → callers draw their fallback.
import { useEffect, useState, type CSSProperties } from 'react';
import { artUrl } from './assets';

export type SheetName = 'bodies' | 'faces' | 'venues-outside' | 'venues-inside' | 'shop' | 'icons' | 'banners' | 'facilities' | 'emblems';

export const SHEETS: Record<SheetName, { cols: number; rows: number; map: boolean }> = {
  bodies: { cols: 8, rows: 2, map: true },
  faces: { cols: 8, rows: 4, map: true },
  'venues-outside': { cols: 2, rows: 2, map: false },
  'venues-inside': { cols: 2, rows: 2, map: false },
  shop: { cols: 4, rows: 2, map: true },
  icons: { cols: 8, rows: 4, map: false },
  banners: { cols: 2, rows: 4, map: false },
  facilities: { cols: 8, rows: 4, map: false },
  emblems: { cols: 8, rows: 4, map: true },
};

interface Loaded { url: string; masks: { r: string; g: string; b: string } | null }
const cache = new Map<SheetName, Promise<Loaded | null>>();
const done = new Map<SheetName, Loaded | null>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Split the colour map into three white-on-transparent masks (one per channel). */
function channelMasks(img: HTMLImageElement): { r: string; g: string; b: string } | null {
  try {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const src = ctx.getImageData(0, 0, c.width, c.height);
    const out: Record<'r' | 'g' | 'b', string> = { r: '', g: '', b: '' };
    (['r', 'g', 'b'] as const).forEach((ch, k) => {
      const d = ctx.createImageData(c.width, c.height);
      for (let i = 0; i < src.data.length; i += 4) {
        const v = [src.data[i], src.data[i + 1], src.data[i + 2]];
        const a = src.data[i + 3];
        const others = v.filter((_, j) => j !== k);
        const on = a > 40 && v[k] > 150 && others.every((o) => o < 110);
        d.data[i] = 255; d.data[i + 1] = 255; d.data[i + 2] = 255; d.data[i + 3] = on ? a : 0;
      }
      ctx.putImageData(d, 0, 0);
      out[ch] = c.toDataURL('image/png');
    });
    return out;
  } catch {
    return null;
  }
}

function load(name: SheetName): Promise<Loaded | null> {
  let p = cache.get(name);
  if (!p) {
    p = (async () => {
      const url = artUrl(`${name}.png`);
      const img = await loadImage(url);
      if (!img) return null;
      let masks: Loaded['masks'] = null;
      if (SHEETS[name].map) {
        const map = await loadImage(artUrl(`${name}-map.png`));
        if (map) masks = channelMasks(map);
      }
      return { url, masks };
    })().then((v) => { done.set(name, v); return v; });
    cache.set(name, p);
  }
  return p;
}

/** The loaded sheet, or null while loading / when the file is missing. */
export function useSheet(name: SheetName): Loaded | null {
  const [v, setV] = useState<Loaded | null>(() => done.get(name) ?? null);
  useEffect(() => {
    let live = true;
    load(name).then((x) => { if (live) setV(x); });
    return () => { live = false; };
  }, [name]);
  return v;
}

export interface Tint { r?: string; g?: string; b?: string }

/** One grid cell, scaled to its box; with a map, club colours and skin are multiplied in. */
export function SheetCell({ sheet, data, index, tint, style, className, mono }: { sheet: SheetName; data: Loaded; index: number; tint?: Tint; style?: CSSProperties; className?: string; mono?: boolean }) {
  const g = SHEETS[sheet];
  const col = index % g.cols;
  const row = Math.floor(index / g.cols) % g.rows;
  const pos = `${g.cols > 1 ? (col / (g.cols - 1)) * 100 : 0}% ${g.rows > 1 ? (row / (g.rows - 1)) * 100 : 0}%`;
  const size = `${g.cols * 100}% ${g.rows * 100}%`;
  const layer = (url: string): CSSProperties => ({ WebkitMask: `url(${url}) ${pos} / ${size} no-repeat`, mask: `url(${url}) ${pos} / ${size} no-repeat` });
  const fill: CSSProperties = { position: 'absolute', inset: 0 };
  if (mono) {
    // white-on-transparent art coloured with the current text colour (icons, symbols)
    return <span className={className} style={{ display: 'inline-block', position: 'relative', background: 'currentColor', ...layer(data.url), ...style }} aria-hidden="true" />;
  }
  return (
    <span className={className} style={{ display: 'inline-block', position: 'relative', overflow: 'hidden', ...style }} aria-hidden="true">
      <span style={{ ...fill, backgroundImage: `url(${data.url})`, backgroundPosition: pos, backgroundSize: size, backgroundRepeat: 'no-repeat' }} />
      {data.masks && tint && (['r', 'g', 'b'] as const).map((ch) => tint[ch] ? <span key={ch} style={{ ...fill, background: tint[ch], mixBlendMode: 'multiply', ...layer(data.masks![ch]) }} /> : null)}
    </span>
  );
}

/** Stable small hash for picking cells. */
export function pickIndex(id: number, n: number, salt = 0): number {
  const x = Math.sin(id * 12.9898 + salt * 78.233) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * n);
}

const cellCache = new Map<string, string | null>();
/** One cell cropped into its own image URL (for cover-fitted backdrops and banners). */
export function useSheetCellUrl(name: SheetName, index: number): string | null {
  const key = `${name}:${index}`;
  const [url, setUrl] = useState<string | null>(() => cellCache.get(key) ?? null);
  useEffect(() => {
    let live = true;
    if (cellCache.has(key)) { setUrl(cellCache.get(key)!); return; }
    load(name).then(async (sh) => {
      if (!sh) { cellCache.set(key, null); if (live) setUrl(null); return; }
      const img = await loadImage(sh.url);
      if (!img) return;
      const g = SHEETS[name];
      const w = Math.floor(img.naturalWidth / g.cols);
      const h = Math.floor(img.naturalHeight / g.rows);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')?.drawImage(img, (index % g.cols) * w, Math.floor(index / g.cols) * h, w, h, 0, 0, w, h);
      let out: string | null = null;
      try { out = c.toDataURL('image/jpeg', 0.86); } catch { out = null; }
      cellCache.set(key, out);
      if (live) setUrl(out);
    });
    return () => { live = false; };
  }, [key, name, index]);
  return url;
}
