import type { LeagueId, Ruleset } from './types';

// Versioned, data-driven ruleset. Everything regulatory lives here so it can be
// audited in game (Results → Rules) and changed per season without code edits.

export const LEAGUE_IDS: LeagueId[] = ['ELITE', 'ORO', 'PLATA'];

export function defaultRuleset(season: number): Ruleset {
  return {
    version: `BD-RULES-${season}.1`,
    season,
    leagues: {
      ELITE: {
        tier: 1, name: 'Liga Élite', short: 'Élite', teams: 16,
        rosterMin: 10, rosterMax: 15, matchdaySquad: 12,
        maxNonEU: 3, minHomegrown: 4,
        minArenaSeats: 5000, promotionFee: 1_200_000,
        centralTv: 1_400_000, centralTvMerit: 900_000, leagueFee: 120_000,
        directPromotion: 0, playoffPromotion: 0, relegation: 2, playoffTeams: 8,
        prizeChampion: 600_000, minPayrollGuarantee: 2_000_000,
      },
      ORO: {
        tier: 2, name: 'Liga Oro', short: 'Oro', teams: 16,
        rosterMin: 10, rosterMax: 14, matchdaySquad: 12,
        maxNonEU: 2, minHomegrown: 5,
        minArenaSeats: 2500, promotionFee: 150_000,
        centralTv: 140_000, centralTvMerit: 60_000, leagueFee: 25_000,
        directPromotion: 1, playoffPromotion: 1, relegation: 2, playoffTeams: 4,
        prizeChampion: 80_000, minPayrollGuarantee: 400_000,
      },
      PLATA: {
        tier: 3, name: 'Liga Plata', short: 'Plata', teams: 16,
        rosterMin: 10, rosterMax: 14, matchdaySquad: 12,
        maxNonEU: 1, minHomegrown: 6,
        minArenaSeats: 800, promotionFee: 0,
        centralTv: 30_000, centralTvMerit: 15_000, leagueFee: 6_000,
        directPromotion: 1, playoffPromotion: 1, relegation: 0, playoffTeams: 4,
        prizeChampion: 20_000, minPayrollGuarantee: 0,
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
  promotionFee: 'Entry guarantee paid to the league when a club is promoted into it. Clubs that cannot pay are denied promotion.',
  minPayrollGuarantee: 'Financial standard: a promoted club must show cash plus approved credit at least this large on promotion day.',
  centralTv: 'Central media distribution paid to every club in the league, in monthly instalments.',
  centralTvMerit: 'Merit share added on top of central TV for the league champion, scaling down linearly to zero for last place.',
  relegation: 'Number of bottom-placed clubs relegated at season end.',
  directPromotion: 'Number of top-placed clubs promoted directly.',
  playoffPromotion: 'Number of extra promotion places decided by playoff.',
};
