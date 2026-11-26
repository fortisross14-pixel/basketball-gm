// Stable appearance for every person in the world: derived from the id, so the same
// player or coach looks identical on every screen, in every save load and every tab.
import type { Player, Staff } from './types';
import { SKIN_TONES, skinIndex, bodyOf, type Frame } from './extras';
import type { World } from './types';

export interface Look {
  skin: string;
  skinIdx: number;
  hair: number; // 1..24 (0 = bald)
  hairColor: string;
  beard: number; // 0 = none, 1..10
  head: number; // 1..12
  eyes: number; // 1..10
  brows: number; // 1..8
  nose: number; // 1..10
  mouth: number; // 1..10
  extra: 'none' | 'headband' | 'goggles' | 'glasses-1' | 'glasses-2' | 'earring';
  frame: Frame;
  outfit: 'jersey' | 'suit' | 'polo';
}

const HAIR_COLORS = ['#141010', '#2a1c14', '#3b2717', '#5a3a1e', '#7a5530', '#b08850', '#d8c08c', '#8a8a8a', '#c9c9c9'];

function h(n: number) {
  const x = Math.sin(n * 78.233 + 1.37) * 43758.5453;
  return x - Math.floor(x);
}
const pick = (seed: number, n: number) => 1 + Math.floor(h(seed) * n);

function base(id: number, nationality: string, ageYears: number, salt: number) {
  const skinIdx = skinIndex(id, nationality, salt);
  const darkHair = skinIdx >= 2 ? 0.92 : 0.6;
  let hairColor = h(id * 3 + salt) < darkHair ? HAIR_COLORS[Math.floor(h(id * 5 + salt) * 3)] : HAIR_COLORS[3 + Math.floor(h(id * 7 + salt) * 3)];
  if (ageYears >= 48 && h(id * 11 + salt) < (ageYears - 40) / 30) hairColor = ageYears >= 60 ? HAIR_COLORS[8] : HAIR_COLORS[7];
  const bald = ageYears >= 40 ? h(id * 13 + salt) < 0.25 : h(id * 13 + salt) < 0.08;
  return {
    skinIdx, skin: SKIN_TONES[skinIdx], hairColor,
    hair: bald ? 0 : pick(id * 17 + salt, 24),
    beard: h(id * 19 + salt) < (ageYears >= 28 ? 0.45 : 0.2) ? pick(id * 23 + salt, 10) : 0,
    head: pick(id * 29 + salt, 12), eyes: pick(id * 31 + salt, 10), brows: pick(id * 37 + salt, 8), nose: pick(id * 41 + salt, 10), mouth: pick(id * 43 + salt, 10),
  };
}

export function playerLook(w: World, p: Player): Look {
  const b = bodyOf(w, p);
  const age = w.season - p.born;
  const r = h(p.id * 47);
  const lk = base(p.id, p.nationality, age, 1);
  return { ...lk, skin: b.skin, frame: b.frame, outfit: 'jersey', extra: r < 0.06 ? 'headband' : r < 0.08 ? 'goggles' : r < 0.12 ? 'earring' : 'none' };
}

export function staffLook(w: World, s: Staff): Look {
  const age = w.season - s.born;
  const r = h(s.id * 53 + 9);
  const lk = base(s.id + 100000, s.nationality, age, 2);
  const frames: Frame[] = ['lean', 'athletic', 'athletic', 'strong', 'heavy'];
  const coach = s.role === 'headCoach' || s.role === 'assistantOff' || s.role === 'assistantDef';
  return { ...lk, frame: frames[Math.floor(h(s.id * 59) * frames.length)], outfit: s.role === 'headCoach' ? 'suit' : coach ? 'polo' : h(s.id * 61) < 0.5 ? 'suit' : 'polo', extra: r < 0.3 ? 'glasses-1' : r < 0.42 ? 'glasses-2' : 'none' };
}
