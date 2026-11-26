import type { Staff, StaffRole, World, OffSystem, DefScheme, Club } from './types';
import { STAFF_FIRST, STAFF_LAST } from './data/names';
import { nextId, rng, clubStaff, staffById } from './world';
import { clamp } from './rng';

export const STAFF_ROLES: StaffRole[] = [
  'headCoach', 'assistantOff', 'assistantDef', 'assistantDev', 'scoutDirector', 'analytics', 'medicalLead', 'physio', 'academyDirector', 'marketingDirector', 'commercialDirector', 'prLead',
];

export const STAFF_LABEL: Record<StaffRole, string> = {
  headCoach: 'Head Coach',
  assistantOff: 'Offensive Assistant',
  assistantDef: 'Defensive Assistant',
  assistantDev: 'Player Development Coach',
  scoutDirector: 'Scouting Director',
  analytics: 'Analytics Director',
  medicalLead: 'Medical Lead',
  physio: 'Performance & Physio Lead',
  academyDirector: 'Academy Director',
  marketingDirector: 'Marketing Director',
  commercialDirector: 'Commercial Director',
  prLead: 'PR & Communications Lead',
};

export const STAFF_GROUP: Record<StaffRole, 'coaching' | 'medical' | 'operations' | 'business'> = {
  headCoach: 'coaching', assistantOff: 'coaching', assistantDef: 'coaching', assistantDev: 'coaching',
  scoutDirector: 'operations', analytics: 'operations', academyDirector: 'operations',
  medicalLead: 'medical', physio: 'medical',
  marketingDirector: 'business', commercialDirector: 'business', prLead: 'business',
};

export const STAFF_EFFECT: Record<StaffRole, string> = {
  headCoach: 'Tactical execution in games, rotation decisions, player morale and development. Their preferred system is executed better.',
  assistantOff: 'Improves offensive efficiency, especially of the chosen offensive system.',
  assistantDef: 'Improves defensive efficiency and scheme execution.',
  assistantDev: 'Speeds up development of players under 26 (weekly training and season-end progression).',
  scoutDirector: 'Sharper rating/potential ranges on scouted players; finds better prospects in assignments.',
  analytics: 'Small in-game edge from lineup optimisation; clearer post-game explanations and contract valuations.',
  medicalLead: 'Lowers injury risk and shortens recovery; advises return-to-play decisions.',
  physio: 'Faster recovery of freshness between games; lowers fatigue-driven injuries.',
  academyDirector: 'Quality and quantity of each summer youth intake; academy player development.',
  marketingDirector: 'Effectiveness of marketing campaigns, merchandise demand and fan growth.',
  commercialDirector: 'Quality and number of sponsorship and TV offers; ticket pricing when delegated.',
  prLead: 'Softens media storms and handles press conferences when delegated.',
};

const OFFS: OffSystem[] = ['paceSpace', 'motion', 'pnr', 'post', 'isolation'];
const DEFS: DefScheme[] = ['switch', 'drop', 'packPaint', 'pressure', 'zone'];

/** Annual salary for staff of a given rating at a given tier. */
export function staffSalary(role: StaffRole, rating: number, tier: number): number {
  const roleMult = role === 'headCoach' ? 2.2 : role.startsWith('assistant') ? 0.8 : role === 'medicalLead' || role === 'commercialDirector' ? 0.9 : 0.7;
  const tierMult = tier === 1 || tier === 0 ? 1 : tier === 2 ? 0.3 : 0.15;
  const base = 25000 * Math.exp((rating - 40) * 0.045) * roleMult;
  return Math.max(3000, Math.round((base * tierMult) / 1000) * 1000);
}

export function generateStaff(w: World, role: StaffRole, rating: number, teamId: number | null, tier: number): Staff {
  const r = rng(w);
  const s: Staff = {
    id: nextId(w),
    firstName: r.pick(STAFF_FIRST),
    lastName: r.pick(STAFF_LAST),
    role,
    born: w.season - r.int(30, 66),
    nationality: r.chance(0.8) ? 'ESP' : r.pick(['SRB', 'GRE', 'ITA', 'LTU', 'USA', 'ARG', 'FRA', 'CRO']),
    rating: Math.round(clamp(rating, 10, 99)),
    offPref: role === 'headCoach' || role === 'assistantOff' ? r.pick(OFFS) : null,
    defPref: role === 'headCoach' || role === 'assistantDef' ? r.pick(DEFS) : null,
    development: Math.round(clamp(rating + r.normal(0, 12), 10, 99)),
    motivation: Math.round(clamp(rating + r.normal(0, 14), 10, 99)),
    ambition: r.int(10, 95),
    loyalty: r.int(10, 95),
    teamId,
    contract: teamId != null ? { salary: staffSalary(role, rating, tier), expires: w.season + r.int(0, 2) } : null,
    reputation: Math.round(clamp(rating + r.normal(-5, 10), 5, 99)),
    history: [],
  };
  return s;
}

export function staffAsk(w: World, s: Staff, tier: number): number {
  return Math.round(staffSalary(s.role, s.rating, tier) * (0.95 + s.ambition / 500) / 1000) * 1000;
}

export function hireStaff(w: World, c: Club, s: Staff, salary: number, years: number) {
  const prevId = c.staff[s.role];
  if (prevId != null) {
    const prev = staffById(w, prevId);
    if (prev) fireStaff(w, c, prev, false);
  }
  s.teamId = c.id;
  s.contract = { salary, expires: w.season + years - 1 };
  s.history.push({ season: w.season, teamId: c.id, role: s.role });
  c.staff[s.role] = s.id;
}

/** Returns severance cost (remaining contract × 50%). */
export function severance(w: World, s: Staff): number {
  if (!s.contract) return 0;
  const years = Math.max(0, s.contract.expires - w.season) + 0.5;
  return Math.round((s.contract.salary * years * 0.5) / 1000) * 1000;
}

export function fireStaff(w: World, c: Club, s: Staff, pay = true): number {
  const cost = pay ? severance(w, s) : 0;
  if (c.staff[s.role] === s.id) delete c.staff[s.role];
  s.teamId = null;
  s.contract = null;
  return cost;
}

export function staffPayroll(w: World, c: Club): number {
  return clubStaff(w, c.id).reduce((a, s) => a + (s.contract?.salary ?? 0), 0);
}

export const OFF_LABEL: Record<OffSystem, string> = {
  paceSpace: 'Pace & Space',
  motion: 'Motion Offence',
  pnr: 'Pick & Roll Heavy',
  post: 'Post / Inside-Out',
  isolation: 'Star Isolation',
};

export const DEF_LABEL: Record<DefScheme, string> = {
  switch: 'Switch Everything',
  drop: 'Drop Coverage',
  packPaint: 'Pack the Paint',
  pressure: 'Pressure & Transition',
  zone: '2-3 Zone',
};
