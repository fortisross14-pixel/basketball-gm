import { create } from 'zustand';
import type { World } from '../engine/types';
import { advance, type AdvanceMode, type AdvanceResult } from '../engine/daily';
import { saveWorld } from '../engine/save';

export interface Toast {
  msg: string;
  tone?: 'good' | 'bad' | 'warn';
  id: number;
}

interface GameStore {
  world: World | null;
  tick: number;
  busy: string | null;
  toast: Toast | null;
  lastAdvance: AdvanceResult | null;
  showResults: boolean;
  setWorld: (w: World | null) => void;
  refresh: () => void;
  /** Mutate the world through an engine call, then re-render. */
  act: <T>(fn: (w: World) => T) => T;
  advance: (mode: AdvanceMode) => Promise<void>;
  notify: (msg: string, tone?: Toast['tone']) => void;
  save: (auto?: boolean) => Promise<void>;
  closeResults: () => void;
}

let toastId = 0;

export const useGame = create<GameStore>((set, get) => ({
  world: null,
  tick: 0,
  busy: null,
  toast: null,
  lastAdvance: null,
  showResults: false,
  setWorld: (w) => set({ world: w, tick: get().tick + 1, lastAdvance: null }),
  refresh: () => set({ tick: get().tick + 1 }),
  act: (fn) => {
    const w = get().world;
    if (!w) throw new Error('No world loaded');
    const out = fn(w);
    set({ tick: get().tick + 1 });
    return out;
  },
  advance: async (mode) => {
    const w = get().world;
    if (!w || get().busy) return;
    set({ busy: mode === 'day' ? 'Simulating day…' : 'Simulating…' });
    await new Promise((r) => setTimeout(r, 20));
    try {
      const res = advance(w, mode);
      set({ lastAdvance: res, showResults: res.gamesPlayed.length > 0 || res.holds.length > 0, tick: get().tick + 1 });
      await get().save(true);
    } catch (e) {
      console.error(e);
      get().notify(`Simulation error: ${(e as Error).message}`, 'bad');
    } finally {
      set({ busy: null });
    }
  },
  notify: (msg, tone) => {
    const id = ++toastId;
    set({ toast: { msg, tone, id } });
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 4500);
  },
  save: async (auto = false) => {
    const w = get().world;
    if (!w) return;
    try {
      await saveWorld(w, auto);
      if (!auto) get().notify('Game saved.', 'good');
    } catch (e) {
      get().notify(`Save failed: ${(e as Error).message}`, 'bad');
    }
  },
  closeResults: () => set({ showResults: false }),
}));

/** Current world (non-null inside game routes) and re-render on every tick. */
export function useWorld(): World {
  const w = useGame((s) => s.world);
  useGame((s) => s.tick);
  if (!w) throw new Error('No world');
  return w;
}

export function useAct() {
  return useGame((s) => s.act);
}

export function useNotify() {
  return useGame((s) => s.notify);
}
