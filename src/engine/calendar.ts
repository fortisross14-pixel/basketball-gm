// Season calendar. A season runs Jul 1 (day 0) → Jun 30. Season 2026 = 2026-27.

const MS_DAY = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function seasonStart(season: number): number {
  return Date.UTC(season, 6, 1);
}

export function seasonLength(season: number): number {
  return Math.round((seasonStart(season + 1) - seasonStart(season)) / MS_DAY);
}

export function dateOf(season: number, day: number): Date {
  return new Date(seasonStart(season) + day * MS_DAY);
}

export function dayOfDate(season: number, year: number, month: number, date: number): number {
  return Math.round((Date.UTC(year, month, date) - seasonStart(season)) / MS_DAY);
}

export function weekday(season: number, day: number): number {
  return dateOf(season, day).getUTCDay();
}

export function absoluteDay(season: number, day: number): number {
  return Math.round((seasonStart(season) - Date.UTC(2000, 6, 1)) / MS_DAY) + day;
}

export function fromAbsolute(abs: number): { season: number; day: number } {
  const date = new Date(Date.UTC(2000, 6, 1) + abs * MS_DAY);
  let season = date.getUTCFullYear();
  if (date.getUTCMonth() < 6) season -= 1;
  return { season, day: Math.round((date.getTime() - seasonStart(season)) / MS_DAY) };
}

export function fmtDate(season: number, day: number, withWeekday = true): string {
  const d = dateOf(season, day);
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return withWeekday ? `${WEEKDAYS[d.getUTCDay()]} ${base}` : base;
}

export function fmtAbs(abs: number, withWeekday = false): string {
  const { season, day } = fromAbsolute(abs);
  return fmtDate(season, day, withWeekday);
}

export function monthOf(season: number, day: number): number {
  return dateOf(season, day).getUTCMonth();
}

export function dateNum(season: number, day: number): number {
  return dateOf(season, day).getUTCDate();
}

export function seasonLabel(season: number): string {
  return `${season}-${String((season + 1) % 100).padStart(2, '0')}`;
}

/** First day >= `from` that falls on weekday `wd`. */
export function nextWeekday(season: number, from: number, wd: number): number {
  let d = from;
  while (weekday(season, d) !== wd) d++;
  return d;
}

export interface SeasonCalendar {
  leagueRoundDays: number[]; // 34 Saturdays (shorter leagues use a spread subset, see roundDaysFor)
  cupDays: { qf: number[]; sf: number; f: number };
  euroGroupDays: number[]; // 14 Wednesdays
  euroQfDays: number[]; // 3
  euroF4Days: { sf: number; f: number };
  playoffStart: number;
  promoStart: number;
  youthIntake: number;
  seasonEnd: number; // awards, promotion/relegation
  jobMarket: number;
  rollover: number; // last day; next day = new season
  summerWindowClose: number;
  winterWindowOpen: number;
  winterWindowClose: number;
  seasonTicketDeadline: number;
  faDeadline: number; // last day free agents can be signed during season
}

const calCache = new Map<number, SeasonCalendar>();
export function buildCalendar(season: number): SeasonCalendar {
  const c = calCache.get(season);
  if (c) return c;
  const built = buildCalendarRaw(season);
  calCache.set(season, built);
  return built;
}

function buildCalendarRaw(season: number): SeasonCalendar {
  // 34 weekend rounds (an 18-team double round robin) from mid-September
  const sep13 = dayOfDate(season, season, 8, 13);
  const firstSat = nextWeekday(season, sep13, 6);
  // Copa del Rey: second weekend of February (Thu–Sun). League skips that Saturday.
  const feb8 = dayOfDate(season, season + 1, 1, 8);
  const cupSat = nextWeekday(season, feb8, 6);
  const cupThu = cupSat - 2;
  const leagueRoundDays: number[] = [];
  let d = firstSat;
  while (leagueRoundDays.length < 34) {
    if (d !== cupSat) leagueRoundDays.push(d);
    d += 7;
  }
  // Euro group stage: Wednesdays from mid-October, skipping Christmas week and Copa del Rey week.
  const xmasWeekStart = dayOfDate(season, season, 11, 21);
  const xmasWeekEnd = dayOfDate(season, season + 1, 0, 3);
  const euroGroupDays: number[] = [];
  let e = nextWeekday(season, firstSat + 4, 3);
  while (euroGroupDays.length < 14) {
    if (!(e >= xmasWeekStart && e <= xmasWeekEnd) && Math.abs(e - cupSat) > 4) euroGroupDays.push(e);
    e += 7;
  }
  const mar1 = dayOfDate(season, season + 1, 2, 1);
  const qf1 = nextWeekday(season, mar1, 3);
  const euroQfDays = [qf1, qf1 + 7, qf1 + 14];
  const lastRound = leagueRoundDays[leagueRoundDays.length - 1];
  const playoffStart = lastRound + 3; // Tuesday after final round
  const f4Fri = nextWeekday(season, lastRound + 1, 5);
  return {
    leagueRoundDays,
    cupDays: { qf: [cupThu, cupThu, cupThu + 1, cupThu + 1], sf: cupSat, f: cupSat + 1 },
    euroGroupDays,
    euroQfDays,
    euroF4Days: { sf: f4Fri, f: f4Fri + 2 },
    playoffStart,
    promoStart: playoffStart,
    youthIntake: dayOfDate(season, season + 1, 5, 15),
    seasonEnd: dayOfDate(season, season + 1, 5, 24),
    jobMarket: dayOfDate(season, season + 1, 5, 27),
    rollover: seasonLength(season) - 1,
    summerWindowClose: dayOfDate(season, season, 8, 30),
    winterWindowOpen: dayOfDate(season, season + 1, 0, 1),
    winterWindowClose: dayOfDate(season, season + 1, 0, 31),
    seasonTicketDeadline: firstSat - 1,
    faDeadline: lastRound - 14,
  };
}

export type Phase = 'offseason' | 'preseason' | 'regular' | 'postseason' | 'endOfSeason';

export function phaseOf(season: number, day: number): Phase {
  const cal = buildCalendar(season);
  if (day < dayOfDate(season, season, 8, 1)) return 'offseason';
  if (day < cal.leagueRoundDays[0]) return 'preseason';
  if (day <= cal.leagueRoundDays[cal.leagueRoundDays.length - 1]) return 'regular';
  if (day < cal.seasonEnd) return 'postseason';
  return 'endOfSeason';
}

export const PHASE_LABEL: Record<Phase, string> = {
  offseason: 'Off-season',
  preseason: 'Pre-season',
  regular: 'Regular season',
  postseason: 'Playoffs',
  endOfSeason: 'End of season',
};

export function transferWindowOpen(season: number, day: number): boolean {
  const cal = buildCalendar(season);
  return day <= cal.summerWindowClose || (day >= cal.winterWindowOpen && day <= cal.winterWindowClose) || day >= cal.seasonEnd;
}

/** Match days for a league with `rounds` rounds: spread over the 34-weekend season. */
export function roundDaysFor(season: number, rounds: number): number[] {
  const all = buildCalendar(season).leagueRoundDays;
  if (rounds >= all.length) return all.slice(0, rounds);
  if (rounds <= 1) return all.slice(0, rounds);
  return Array.from({ length: rounds }, (_, i) => all[Math.round((i * (all.length - 1)) / (rounds - 1))]);
}
