// Summer training camps: 12 destinations, priced by distance from the club's country, facility
// quality and length. A camp builds cohesion and match shape, develops young players, and far
// trips grow the fanbase abroad; tough climates and hard schedules carry some injury risk.
import type { Club, World } from './types';
import { absDay } from './types';
import { addNews, book, fmtMoney, isUser, nextId, roster, rng, tierOf, playerName } from './world';
import { buildCalendar, fmtDate, dayOfDate } from './calendar';
import { trainingTick } from './player';
import { clamp } from './rng';

export interface CampDest {
  id: string;
  name: string;
  place: string;
  country: string;
  flag: string;
  lat: number;
  lon: number;
  dailyRate: number; // € per person per day (lodging, food, courts)
  quality: number; // 1-5 facility level
  days: number;
  blurb: string;
  injuryRisk: number; // multiplier (heat, altitude, double sessions)
  exposure: number; // 0..1 international/national fan growth
  home?: boolean;
}

export const CAMPS: CampDest[] = [
  { id: 'home', name: 'Home base camp', place: 'Your own facilities', country: '', flag: '🏠', lat: 0, lon: 0, dailyRate: 25, quality: 1, days: 10, blurb: 'Double sessions at home. Almost free; the team sleeps in its own beds.', injuryRisk: 0.8, exposure: 0, home: true },
  { id: 'sierra', name: 'Sierra Nevada altitude centre', place: 'Granada, Spain', country: 'ESP', flag: '🇪🇸', lat: 37.1, lon: -3.4, dailyRate: 105, quality: 3, days: 10, blurb: 'High-altitude conditioning: lungs and legs for the season.', injuryRisk: 1.2, exposure: 0.02 },
  { id: 'algarve', name: 'Algarve sports resort', place: 'Vilamoura, Portugal', country: 'PRT', flag: '🇵🇹', lat: 37.1, lon: -8.1, dailyRate: 120, quality: 3, days: 9, blurb: 'Good courts, sea air, a relaxed group. Cheap from Spain.', injuryRisk: 0.9, exposure: 0.03 },
  { id: 'andorra', name: 'Pyrenees mountain camp', place: 'Andorra la Vella, Andorra', country: 'AND', flag: '🇦🇩', lat: 42.5, lon: 1.5, dailyRate: 110, quality: 2, days: 8, blurb: 'Hiking, team building and a quiet valley. Strong on chemistry.', injuryRisk: 1, exposure: 0.01 },
  { id: 'cote', name: 'Côte d’Azur performance hotel', place: 'Antibes, France', country: 'FRA', flag: '🇫🇷', lat: 43.6, lon: 7.1, dailyRate: 190, quality: 4, days: 9, blurb: 'Premium hotel with a pro gym and recovery spa.', injuryRisk: 0.8, exposure: 0.05 },
  { id: 'tuscany', name: 'Tuscany basketball retreat', place: 'Florence, Italy', country: 'ITA', flag: '🇮🇹', lat: 43.8, lon: 11.2, dailyRate: 165, quality: 3, days: 10, blurb: 'Friendlies against Italian clubs and a big tactical block.', injuryRisk: 1, exposure: 0.05 },
  { id: 'bled', name: 'Lake Bled training centre', place: 'Bled, Slovenia', country: 'SVN', flag: '🇸🇮', lat: 46.4, lon: 14.1, dailyRate: 130, quality: 3, days: 10, blurb: 'Lakeside courts, cool summers, long sessions.', injuryRisk: 0.9, exposure: 0.04 },
  { id: 'kaunas', name: 'Kaunas basketball school', place: 'Kaunas, Lithuania', country: 'LTU', flag: '🇱🇹', lat: 54.9, lon: 23.9, dailyRate: 120, quality: 4, days: 12, blurb: 'Fundamentals at a legendary basketball academy: best for young players.', injuryRisk: 1, exposure: 0.06 },
  { id: 'belgrade', name: 'Belgrade national centre', place: 'Belgrade, Serbia', country: 'SRB', flag: '🇷🇸', lat: 44.8, lon: 20.5, dailyRate: 95, quality: 3, days: 11, blurb: 'Tough Balkan practice, scrimmages against strong youth teams.', injuryRisk: 1.25, exposure: 0.04 },
  { id: 'antalya', name: 'Antalya sports complex', place: 'Antalya, Turkey', country: 'TUR', flag: '🇹🇷', lat: 36.9, lon: 30.7, dailyRate: 105, quality: 3, days: 10, blurb: 'All-inclusive complex; hot afternoons, so sessions start early.', injuryRisk: 1.15, exposure: 0.05 },
  { id: 'doha', name: 'Doha high-performance centre', place: 'Doha, Qatar', country: 'QAT', flag: '🇶🇦', lat: 25.3, lon: 51.5, dailyRate: 320, quality: 5, days: 12, blurb: 'World-class sports science, cryo and analytics. The best camp money can buy.', injuryRisk: 0.7, exposure: 0.1 },
  { id: 'vegas', name: 'Las Vegas summer showcase', place: 'Las Vegas, USA', country: 'USA', flag: '🇺🇸', lat: 36.2, lon: -115.1, dailyRate: 260, quality: 4, days: 12, blurb: 'Pro-level gyms and scrimmages with NBA prospects. Big for exposure.', injuryRisk: 1.1, exposure: 0.14 },
];

const HOME: Record<string, [number, number]> = { ESP: [40.4, -3.7], USA: [39.1, -94.6] };
const PARTY = 18; // players + staff travelling

function km(a: [number, number], b: [number, number]): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface CampQuote { dest: CampDest; km: number; travel: number; stay: number; total: number; cohesion: number; sharpness: number; devSessions: number; injuryChance: number; exposurePct: number }

export function campQuote(w: World, c: Club, d: CampDest): CampQuote {
  const home = HOME[c.country] ?? HOME.ESP;
  const dist = d.home ? 0 : km(home, [d.lat, d.lon]);
  const t = tierOf(w, c);
  const lodging = t === 3 ? 0.85 : 1; // small clubs book cheaper rooms
  const travel = d.home ? 0 : Math.round((PARTY * (dist < 900 ? dist * 0.18 : 140 + dist * 0.11)) / 100) * 100; // bus for short trips, flights beyond
  const stay = Math.round((PARTY * d.days * d.dailyRate * lodging) / 100) * 100;
  const away = d.home ? 0 : 1;
  return {
    dest: d, km: Math.round(dist), travel, stay, total: travel + stay,
    cohesion: Math.round((2 + d.quality * 1.1 + away * 1.5 + d.days * 0.15) * 10) / 10,
    sharpness: Math.round((1 + d.quality * 0.9) * 10) / 10,
    devSessions: Math.round(d.days * (0.6 + d.quality * 0.35)),
    injuryChance: Math.round(Math.min(0.5, 0.012 * d.days * d.injuryRisk) * 100) / 100,
    exposurePct: Math.round(d.exposure * 100),
  };
}

/** Days the camp may run: from mid-July to a week before the first league game. */
export function campWindow(w: World): { from: number; to: number } {
  const cal = buildCalendar(w.season);
  return { from: Math.max(w.day + 1, dayOfDate(w.season, w.season, 6, 15)), to: cal.leagueRoundDays[0] - 7 };
}

export function campBusyReason(w: World, c: Club, startDay: number, days: number): string | null {
  const win = campWindow(w);
  if (startDay < win.from) return 'Pick a later start date.';
  if (startDay + days > win.to) return 'The camp must finish a week before the league starts.';
  const clash = w.fixtures.find((f) => !f.cancelled && !f.played && (f.homeId === c.id || f.awayId === c.id) && f.day >= startDay - 1 && f.day <= startDay + days);
  if (clash) return `It clashes with your ${clash.label} on ${fmtDate(w.season, clash.day)}.`;
  return null;
}

export function bookCamp(w: World, c: Club, id: string, startDay: number): { ok: boolean; message: string } {
  const d = CAMPS.find((x) => x.id === id);
  if (!d) return { ok: false, message: 'Unknown camp.' };
  if (c.camp && c.camp.season === w.season) return { ok: false, message: 'You already booked a camp this summer.' };
  const busy = campBusyReason(w, c, startDay, d.days);
  if (busy) return { ok: false, message: busy };
  const q = campQuote(w, c, d);
  if (q.total > c.finances.cash) return { ok: false, message: `Not enough cash: the camp costs ${fmtMoney(q.total)}.` };
  book(w, c, 'travel', -q.total);
  c.camp = { id: d.id, season: w.season, startDay, endDay: startDay + d.days, cost: q.total, done: false, bookingId: nextId(w) };
  addNews(w, `${c.name} book a training camp: ${d.name}`, `${d.place}, ${fmtDate(w.season, startDay)} – ${fmtDate(w.season, startDay + d.days)}. Cost ${fmtMoney(q.total)}.`, { tags: ['club'], clubIds: [c.id] });
  return { ok: true, message: `${d.name} booked: ${d.days} days from ${fmtDate(w.season, startDay)} for ${fmtMoney(q.total)}.` };
}

export function cancelCamp(w: World, c: Club): { ok: boolean; message: string } {
  if (!c.camp || c.camp.done || c.camp.season !== w.season) return { ok: false, message: 'No camp to cancel.' };
  if (w.day >= c.camp.startDay) return { ok: false, message: 'The camp has already started.' };
  const refund = Math.round(c.camp.cost * 0.5);
  book(w, c, 'travel', refund);
  delete c.camp;
  return { ok: true, message: `Camp cancelled. Half the cost (${fmtMoney(refund)}) is refunded.` };
}

export function inCamp(w: World, c: Club, day = w.day): boolean {
  return !!c.camp && c.camp.season === w.season && !c.camp.done && day >= c.camp.startDay && day < c.camp.endDay;
}

/** Daily: run the camp's training and apply its results on the last day. */
export function dailyCamp(w: World) {
  const c = w.user.clubId != null ? w.clubs.find((x) => x.id === w.user.clubId) : undefined;
  if (!c?.camp || c.camp.done || c.camp.season !== w.season) return;
  const d = CAMPS.find((x) => x.id === c.camp!.id);
  if (!d) return;
  const r = rng(w);
  const squad = roster(w, c.id);
  if (inCamp(w, c)) {
    // double sessions: extra development for young players, tired legs
    const q = campQuote(w, c, d);
    const perDay = q.devSessions / d.days;
    for (const p of squad) {
      if (r.chance(perDay)) trainingTick(w, p, r, 'development', 'hard');
      p.freshness = clamp(p.freshness - 1.5, 55, 100);
      if (!p.injury && r.chance(q.injuryChance / d.days / squad.length * 3)) p.injury = { type: 'Muscle strain', daysOut: r.int(4, 14), severity: 'minor' };
    }
    return;
  }
  if (w.day < c.camp.endDay) return;
  // camp over: results
  const q = campQuote(w, c, d);
  c.camp.done = true;
  c.cohesion = clamp(c.cohesion + q.cohesion, 0, 100);
  for (const p of squad) {
    p.form = clamp(Math.max(p.form, 0) + q.sharpness, -10, 10);
    p.morale = clamp(p.morale + (d.home ? 1 : 3), 0, 100);
    p.freshness = Math.max(p.freshness, 85);
  }
  if (d.exposure > 0) {
    c.fans.international = Math.round(c.fans.international * (1 + d.exposure));
    c.fans.national = Math.round(c.fans.national * (1 + d.exposure * 0.3));
    c.fans.digital = Math.round(c.fans.digital * (1 + d.exposure * 0.5));
  }
  const hurt = squad.filter((p) => p.injury && p.injury.type === 'Muscle strain');
  if (isUser(w, c.id)) addNews(w, `Training camp over: ${d.name}`, `Cohesion +${q.cohesion}, match shape up${d.exposure ? `, fans abroad +${q.exposurePct}%` : ''}.${hurt.length ? ` Knocks: ${hurt.map(playerName).join(', ')}.` : ' No injuries.'}`, { tags: ['club'], clubIds: [c.id], importance: 2 });
}

/** Preseason readiness: cohesion and match shape of the top eight. */
export function readiness(w: World, c: Club): { cohesion: number; shape: number; label: string } {
  const top = roster(w, c.id).sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  const shape = top.length ? top.reduce((a, p) => a + p.form, 0) / top.length : 0;
  const score = c.cohesion * 0.6 + (shape + 10) * 2;
  return { cohesion: Math.round(c.cohesion), shape: Math.round(shape * 10) / 10, label: score >= 75 ? 'Ready for the season' : score >= 58 ? 'Getting there' : 'Rusty: book friendlies or a camp' };
}

export { absDay };
