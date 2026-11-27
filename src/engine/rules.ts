import type { LeagueId, Ruleset, World } from './types';

// Versioned, data-driven ruleset. Everything regulatory lives here so it can be
// audited in game (Results → Rules) and changed per season without code edits.

export const LEAGUE_IDS: LeagueId[] = ['ELITE', 'ORO', 'PLATA', 'TERCERA', 'COLLEGE', 'NBA'];
/** The Spanish pyramid (promotion & relegation), top to bottom. */
export const PYRAMID: LeagueId[] = ['ELITE', 'ORO', 'PLATA', 'TERCERA'];
export const LEAGUE_COUNTRY: Record<LeagueId, string> = { ELITE: 'ESP', ORO: 'ESP', PLATA: 'ESP', TERCERA: 'ESP', COLLEGE: 'USA', NBA: 'USA' };

/** Leagues that exist in this save (older saves have fewer) and have clubs. */
export function activeLeagues(w: World): LeagueId[] {
  return LEAGUE_IDS.filter((id) => w.rules.leagues[id] && w.clubs.some((c) => c.leagueId === id));
}
export function activePyramid(w: World): LeagueId[] {
  return PYRAMID.filter((id) => w.rules.leagues[id] && w.clubs.some((c) => c.leagueId === id));
}

export function defaultRuleset(season: number): Ruleset {
  return {
    version: `BD-RULES-${season}.1`,
    season,
    leagues: {
      ELITE: {
        kind: 'pro', country: 'ESP', tier: 1, name: 'Liga ACB', short: 'ACB', teams: 18,
        rosterMin: 10, rosterMax: 15, matchdaySquad: 12,
        maxNonEU: 3, minHomegrown: 4,
        minArenaSeats: 5000, promotionFee: 450_000,
        centralTv: 1_400_000, centralTvMerit: 900_000, leagueFee: 120_000,
        directPromotion: 0, playoffPromotion: 0, relegation: 2, playoffTeams: 8,
        prizeChampion: 600_000, minPayrollGuarantee: 1_000_000,
      },
      ORO: {
        kind: 'pro', country: 'ESP', tier: 2, name: 'Primera FEB', short: 'Primera FEB', teams: 18,
        rosterMin: 10, rosterMax: 14, matchdaySquad: 12,
        maxNonEU: 2, minHomegrown: 5,
        minArenaSeats: 2500, promotionFee: 60_000,
        centralTv: 140_000, centralTvMerit: 60_000, leagueFee: 25_000,
        directPromotion: 1, playoffPromotion: 1, relegation: 3, playoffTeams: 8,
        prizeChampion: 80_000, minPayrollGuarantee: 200_000,
      },
      PLATA: {
        kind: 'pro', country: 'ESP', tier: 3, name: 'Segunda FEB', short: 'Segunda FEB', teams: 28, grouped: true,
        rosterMin: 10, rosterMax: 14, matchdaySquad: 12,
        maxNonEU: 1, minHomegrown: 6,
        minArenaSeats: 500, promotionFee: 0,
        centralTv: 30_000, centralTvMerit: 15_000, leagueFee: 6_000,
        directPromotion: 2, playoffPromotion: 1, relegation: 6, playoffTeams: 8,
        prizeChampion: 20_000, minPayrollGuarantee: 0,
      },
      TERCERA: {
        kind: 'pro', country: 'ESP', tier: 4, name: 'Tercera FEB', short: 'Tercera FEB', teams: 138, grouped: true,
        rosterMin: 9, rosterMax: 14, matchdaySquad: 12,
        maxNonEU: 1, minHomegrown: 7,
        minArenaSeats: 300, promotionFee: 0,
        centralTv: 0, centralTvMerit: 0, leagueFee: 2_500,
        directPromotion: 6, playoffPromotion: 0, relegation: 0, playoffTeams: 0,
        prizeChampion: 6_000, minPayrollGuarantee: 0,
      },
      COLLEGE: {
        kind: 'college', country: 'USA', tier: 2, name: 'NCAA Division I', short: 'NCAA', teams: 32, grouped: true,
        rosterMin: 10, rosterMax: 15, matchdaySquad: 13,
        maxNonEU: 99, minHomegrown: 0,
        minArenaSeats: 0, promotionFee: 0,
        centralTv: 260_000, centralTvMerit: 180_000, leagueFee: 15_000,
        directPromotion: 0, playoffPromotion: 0, relegation: 0, playoffTeams: 16,
        prizeChampion: 250_000, minPayrollGuarantee: 0,
      },
      NBA: {
        kind: 'nba', country: 'USA', tier: 0, name: 'NBA', short: 'NBA', teams: 30, grouped: true,
        rosterMin: 13, rosterMax: 15, matchdaySquad: 13,
        maxNonEU: 99, minHomegrown: 0,
        minArenaSeats: 0, promotionFee: 0,
        centralTv: 0, centralTvMerit: 0, leagueFee: 0,
        directPromotion: 0, playoffPromotion: 0, relegation: 0, playoffTeams: 16,
        prizeChampion: 0, minPayrollGuarantee: 0,
      },
    },
    euro: { teams: 16, fromElite: 4, prizeParticipation: 400_000, prizePerWin: 60_000, prizeChampion: 1_500_000, tvShare: 500_000 },
    cup: { teams: 8, prizeWinner: 350_000, prizeParticipation: 90_000 },
    windows: { summerClose: 91, winterOpen: 184, winterClose: 214 }, // Sep 30, Jan 1, Jan 31
  };
}

export const RULE_EXPLAINERS: Record<string, string> = {
  maxNonEU: 'Maximum players from outside the European Union registered on the roster (EU and domestic players are unrestricted).',
  minHomegrown: 'Minimum "formation" players (trained in the domestic system) on the roster. Spanish nationals and players who came through a domestic academy count.',
  minArenaSeats: 'Minimum arena capacity required to compete in the league. A promoted club below this capacity is denied promotion unless an expansion is completed or underway.',
  promotionFee: 'Entry guarantee paid to the league when a club is promoted into it. It can be covered with cash or available bank credit; clubs that cannot cover it are denied promotion.',
  minPayrollGuarantee: 'Financial standard: a promoted club must show cash, owner guarantees and available bank credit (half of annual revenue minus existing debt) at least this large on promotion day.',
  centralTv: 'Central media distribution paid to every club in the league, in monthly instalments.',
  centralTvMerit: 'Merit share added on top of central TV for the league champion, scaling down linearly to zero for last place.',
  relegation: 'Number of bottom-placed clubs relegated at season end.',
  directPromotion: 'Number of top-placed clubs promoted directly.',
  playoffPromotion: 'Number of extra promotion places decided by playoff.',
  kind: 'College leagues have no promotion or relegation. Players are amateurs on scholarship plus a small NIL (name, image & likeness) payment, must be 22 or younger, and leave when their eligibility ends or when they declare for the pros.',
};
