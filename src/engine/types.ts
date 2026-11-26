// ============================================================================
// Basketball Dynasty — core data model
// Everything the simulation persists lives inside `World` (one save = one World).
// ============================================================================

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export type Region = 'ESP' | 'EU' | 'NONEU';

export const RATING_KEYS = [
  'ins', 'mid', 'thr', 'ft', 'pas', 'hnd', 'reb', 'pdef', 'idef', 'stl', 'blk', 'spd', 'str', 'jmp', 'end', 'iq',
] as const;
export type RatingKey = (typeof RATING_KEYS)[number];
export type Ratings = Record<RatingKey, number>;

export interface Personality {
  workEthic: number; // development speed
  clutch: number; // late-game shooting
  leadership: number; // cohesion / morale of teammates
  loyalty: number; // willingness to renew / discount
  adaptability: number; // new club / new system adjustment
  greed: number; // salary weight in negotiations
  ambition: number; // weight on winning / club level
  ego: number; // minutes demands, locker-room risk
}

export type AgentStyle = 'relationship' | 'hardline' | 'cash' | 'empowerment' | 'development' | 'media';

export interface Agent {
  name: string;
  style: AgentStyle;
}

export type RolePromise = 'star' | 'starter' | 'rotation' | 'bench' | 'prospect';

export interface Contract {
  salary: number; // annual, EUR
  expires: number; // last season year covered (season 2026 = 2026-27)
  buyout: number | null; // release clause; a bid ≥ buyout cannot be refused by the club
  rolePromise: RolePromise;
  signedSeason: number;
  signingBonus: number;
  youth?: boolean; // academy contract
}

export interface Injury {
  type: string;
  daysOut: number;
  severity: 'minor' | 'moderate' | 'major';
  playThroughRisk?: boolean; // medical cleared a risky early return
}

export type CompType = 'league' | 'playoffs' | 'cup' | 'euro' | 'promo' | 'friendly';

export interface StatLine {
  gp: number; gs: number; min: number; pts: number;
  fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number;
  orb: number; drb: number; ast: number; stl: number; blk: number; tov: number; pf: number; pm: number;
}

export interface SeasonStats extends StatLine {
  season: number;
  teamId: number;
  comp: CompType;
}

export interface CareerEntry {
  season: number;
  teamId: number;
  tier: number;
  ovr: number;
}

export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  nationality: string;
  region: Region;
  homegrown: boolean; // counts towards "formation player" quotas
  born: number; // birth year
  heightCm: number;
  pos: Position;
  ratings: Ratings;
  ovr: number; // cached overall
  pot: number; // true potential (hidden; scouting reveals a range)
  personality: Personality;
  injuryProne: number; // 0-100
  agent: Agent;
  teamId: number | null; // null = free agent / retired
  academy: boolean; // in a club's youth academy (not first-team roster)
  contract: Contract | null;
  loan: { fromTeamId: number; untilSeason: number; wageShare: number } | null;
  morale: number; // 0-100
  freshness: number; // 0-100 season-level fatigue (100 = fresh)
  form: number; // -10..10 recent form
  injury: Injury | null;
  stats: SeasonStats[];
  career: CareerEntry[];
  jersey: number;
  retired: boolean;
  hallOfFame: boolean;
  originClubId: number | null; // academy of origin
  value: number; // cached market value EUR
  transferListed: boolean;
  /** absolute day the player was put up for an immediate sale (sold the next day at a minimum fee) */
  quickSaleDay?: number;
  untouchable: boolean;
  minutesExpectation: number; // computed per season (minutes per game desired)
  seasonMinutes: number; // minutes this season (all comps)
  awards: { season: number; award: string }[];
  joinedDay: number; // absolute day joined current club (for cohesion)
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------
export type StaffRole =
  | 'headCoach'
  | 'assistantOff'
  | 'assistantDef'
  | 'assistantDev'
  | 'scoutDirector'
  | 'analytics'
  | 'medicalLead'
  | 'physio'
  | 'academyDirector'
  | 'marketingDirector'
  | 'commercialDirector'
  | 'prLead';

export interface Staff {
  id: number;
  firstName: string;
  lastName: string;
  role: StaffRole;
  born: number;
  nationality: string;
  rating: number; // 0-100 core competence
  // coach-only identity
  offPref: OffSystem | null;
  defPref: DefScheme | null;
  development: number; // 0-100 player development skill
  motivation: number; // 0-100 man-management
  ambition: number; // likelihood to leave for a bigger job
  loyalty: number;
  teamId: number | null;
  contract: { salary: number; expires: number } | null;
  reputation: number; // 0-100
  history: { season: number; teamId: number; role: StaffRole }[];
}

// ---------------------------------------------------------------------------
// Tactics
// ---------------------------------------------------------------------------
export type OffSystem = 'paceSpace' | 'motion' | 'pnr' | 'post' | 'isolation';
export type DefScheme = 'switch' | 'drop' | 'packPaint' | 'pressure' | 'zone';
export type Pace = 'slow' | 'normal' | 'fast';
export type RotationStyle = 'tight' | 'balanced' | 'deep' | 'development' | 'veteran';

export interface Tactics {
  off: OffSystem;
  def: DefScheme;
  pace: Pace;
  rotation: RotationStyle;
  threeEmphasis: number; // -2..2
  reboundEmphasis: number; // -2..2 (crash boards vs get back)
  foulDiscipline: number; // -2..2 (aggressive vs careful)
  starUsage: number; // -2..2 feed the best player
  starters: number[]; // 5 player ids (empty -> auto)
  rotationOrder: number[]; // bench order
  minuteLimits: Record<number, number>; // playerId -> max minutes
}

export type TrainingFocus = 'balanced' | 'offense' | 'defense' | 'shooting' | 'conditioning' | 'development' | 'tactical';
export type TrainingIntensity = 'light' | 'normal' | 'hard';

// ---------------------------------------------------------------------------
// Arena / infrastructure
// ---------------------------------------------------------------------------
export type SeatZone = 'general' | 'lower' | 'premium';
export const SEAT_ZONES: SeatZone[] = ['general', 'lower', 'premium'];

export type FacilityKey =
  | 'concessions'
  | 'restaurant'
  | 'hospitality'
  | 'store'
  | 'onlineStore'
  | 'videoboard'
  | 'lockerRoom'
  | 'training'
  | 'medical'
  | 'academy'
  | 'accessibility'
  | 'parking';

export interface Arena {
  name: string;
  seats: Record<SeatZone, number>;
  suites: number;
  levels: Record<FacilityKey, number>; // 0-5
  condition: number; // 0-100, decays; maintenance budget restores
  opened: number; // season
  owned: boolean; // municipal (rent) vs owned
  rentPerGame: number;
}

export type ProjectKind =
  | 'office'
  | 'store'
  | 'storeUpgrade'
  | 'expandGeneral'
  | 'expandLower'
  | 'premiumSeats'
  | 'suites'
  | 'facility'
  | 'renovation'
  | 'newArena';

export interface ArenaProject {
  id: number;
  kind: ProjectKind;
  facility?: FacilityKey;
  office?: OfficeKey;
  storeKind?: StoreKind;
  storeId?: number;
  label: string;
  cost: number;
  paid: number;
  startDay: number; // absolute day
  endDay: number;
  disruption: number; // fraction of seats unavailable while building
  financing: 'cash' | 'loan';
  seatsDelta?: Partial<Record<SeatZone, number>>;
  suitesDelta?: number;
  newArenaSeats?: Record<SeatZone, number>;
  newArenaSuites?: number;
}

export interface Ticketing {
  prices: Record<SeatZone, number>; // single-game base price
  seasonPrices: Record<SeatZone, number>;
  seasonSold: Record<SeatZone, number>;
  suitePrice: number; // per suite per season
  suitesSold: number;
  bigGameMarkup: number; // 0..0.6 extra on marquee opponents
  playoffMarkup: number; // 0..1
  dynamicPricing: boolean;
  protectSeasonHolders: boolean;
  promoNights: 'none' | 'monthly' | 'biweekly' | 'weekly';
  studentDiscount: boolean;
}

export type ConcessionPricing = 'value' | 'standard' | 'premium';

export interface Concessions {
  pricing: ConcessionPricing;
  localSuppliers: boolean; // lower margin, better sentiment & community
}

export type MerchLine = 'home' | 'away' | 'retro' | 'city' | 'european' | 'signature' | 'kids' | 'lifestyle';

// ---------------------------------------------------------------------------
// Club facilities (infrastructure section). All optional: old saves initialise lazily.
// ---------------------------------------------------------------------------
export type OfficeKey = 'corporate' | 'pr';
export type StoreKind = 'arena' | 'online' | 'city' | 'outlet' | 'airport';
/** Facilities that can have a responsible staff member. */
export type OwnedFacility = 'training' | 'academy' | 'lockerRoom' | 'medical';

export interface ClubStore {
  id: number;
  kind: StoreKind;
  name: string;
  level: number; // 1-3 for extra stores (arena/online mirror arena facility levels)
  lines: MerchLine[];
  priceMult: number; // 0.8-1.3 vs club jersey price
  stock: 'lean' | 'normal' | 'deep';
  managerId: number | null;
  openedDay: number;
  lastWeekSales: number; // revenue
  lastWeekUnits: number;
  seasonSales: number;
}

export interface ClubFacilities {
  owners: Partial<Record<OwnedFacility, number>>; // staff id
  offices: Record<OfficeKey, number>; // levels 1-5
  stores: ClubStore[];
  lastPress: number | null; // abs day of last user press conference
  pressLog: { day: number; topic: string; stance: string; result: string }[];
  usage: Partial<Record<OwnedFacility, number>>; // last weekly usage score 0-100
  officeBase?: Record<OfficeKey, number>; // levels the club started with (only expansions cost upkeep)
}

export interface Merch {
  lines: MerchLine[];
  jerseyPrice: number;
  inventory: 'lean' | 'normal' | 'deep';
  onlineShare: number; // 0..1 allocation online
  stockValue: number; // unsold inventory value carried
  orderedUnits: number; // units ordered this season
  signaturePlayerId: number | null;
}

// ---------------------------------------------------------------------------
// Commercial
// ---------------------------------------------------------------------------
export type SponsorSlot = 'shirt' | 'shirtSecondary' | 'naming' | 'court' | 'local1' | 'local2' | 'local3' | 'digital';
export const SPONSOR_SLOTS: SponsorSlot[] = ['shirt', 'shirtSecondary', 'naming', 'court', 'local1', 'local2', 'local3', 'digital'];

export interface SponsorDeal {
  id: number;
  slot: SponsorSlot;
  brand: string;
  category: string;
  annual: number;
  expires: number; // season
  promoBonus: number;
  titleBonus: number;
  fit: number; // 0-100 brand fit with club identity
  risk: number; // 0-100 reputational risk
  signedSeason: number;
}

export interface SponsorOffer extends SponsorDeal {
  expiresDay: number; // absolute day the offer lapses
}

export type BroadcasterKind = 'public' | 'payTV' | 'streamer' | 'regional' | 'global';

export interface TvDeal {
  id: number;
  broadcaster: string;
  kind: BroadcasterKind;
  annual: number;
  expires: number;
  reach: number; // 0-100 exposure → national/international fan growth
  digitalBoost: number; // 0-100
  exclusivity: boolean;
}

export interface TvOffer extends TvDeal {
  expiresDay: number;
}

export type CampaignKind = 'community' | 'regionalAds' | 'social' | 'seasonTicketDrive' | 'schoolClinics' | 'internationalTour' | 'starPromo';

export interface Campaign {
  id: number;
  kind: CampaignKind;
  weeksLeft: number;
  weeklyCost: number;
  intensity: number; // multiplier from marketing director
}

export interface Fanbase {
  local: number;
  regional: number;
  national: number;
  international: number;
  digital: number;
  loyalty: number; // 0-100
  sentiment: number; // 0-100 current mood
  hype: number; // 0-100 short-term buzz
}

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------
export type LedgerCat =
  | 'tickets'
  | 'seasonTickets'
  | 'suites'
  | 'concessions'
  | 'merch'
  | 'sponsors'
  | 'tv'
  | 'prize'
  | 'transfersIn'
  | 'grants'
  | 'ownerInjection'
  | 'other'
  | 'playerSalaries'
  | 'staffSalaries'
  | 'transfersOut'
  | 'agentFees'
  | 'travel'
  | 'operations'
  | 'maintenance'
  | 'rent'
  | 'marketing'
  | 'merchCost'
  | 'construction'
  | 'interest'
  | 'loanPrincipal'
  | 'academyCost'
  | 'scouting'
  | 'medicalCost'
  | 'leagueFees'
  | 'penalties'
  | 'loanIn'
  | 'severance';

export const INCOME_CATS: LedgerCat[] = [
  'tickets', 'seasonTickets', 'suites', 'concessions', 'merch', 'sponsors', 'tv', 'prize', 'transfersIn', 'grants', 'ownerInjection', 'loanIn', 'other',
];

export interface Loan {
  id: number;
  lender: string;
  principal: number;
  balance: number;
  rate: number; // annual
  monthlyPayment: number;
  startDay: number;
  endDay: number;
  covenantDebtToRevenue: number; // board alarm above this
}

export interface Finances {
  cash: number;
  loans: Loan[];
  // per-season totals by category (signed: income positive, expense negative)
  seasonTotals: Record<number, Partial<Record<LedgerCat, number>>>;
  // weekly cash snapshots for charts
  cashHistory: { day: number; cash: number }[];
  budget: Budget;
  overdueDays: number; // days with negative cash
}

export interface Budget {
  payroll: number; // approved annual player payroll
  transfer: number; // remaining transfer budget this season
  staff: number;
  marketing: number;
  scouting: number; // annual
  medical: number;
  maintenance: number;
  academy: number;
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------
export type ObjectiveKind = 'leaguePos' | 'promotion' | 'avoidRelegation' | 'profit' | 'maxLoss' | 'youthMinutes' | 'fanGrowth' | 'euroQualify' | 'cupRun' | 'attendance';

export interface Objective {
  id: number;
  kind: ObjectiveKind;
  target: number;
  label: string;
  weight: number; // 1-3
  status: 'pending' | 'met' | 'failed';
  progress: number; // 0..1 (computed)
  promise?: boolean; // made by the player (bigger trust swing)
}

export interface TrustComponents {
  results: number;
  finances: number;
  fans: number;
  media: number;
  promises: number;
  relationship: number;
}

export interface Board {
  owner: string;
  ownerWealth: number; // 0-100 ability to inject cash
  ambition: number; // 0-100 spending appetite
  patience: number; // 0-100
  riskAppetite: number; // 0-100 tolerance for debt
  trust: TrustComponents;
  overall: number; // 0-100
  objectives: Objective[];
  plan: { years: number; vision: string; competitiveTarget: string; profitTolerance: string; development: string };
  ultimatum: { day: number; objective: string } | null;
  injectionsThisSeason: number;
  autonomy: 'full' | 'restricted'; // restricted after failures: board approves signings
  fanBaseline: number; // local fans at season start (fan-growth objective)
}

// ---------------------------------------------------------------------------
// Club
// ---------------------------------------------------------------------------
export type AiStrategy = 'contend' | 'balanced' | 'rebuild' | 'survive' | 'develop';

export interface SeasonRecord {
  season: number;
  leagueId: LeagueId | null;
  tier: number;
  rank: number;
  wins: number;
  losses: number;
  playoff: string; // e.g. 'Champion', 'Semifinal', '—'
  cup: string;
  euro: string;
  revenue: number;
  profit: number;
  attendance: number;
  promoted: boolean;
  relegated: boolean;
  coach: string;
  topPlayer: string;
}

export interface Club {
  id: number;
  name: string;
  nickname: string;
  abbrev: string;
  city: string;
  region: string;
  country: string;
  foreign: boolean; // EURO-only club (not in domestic pyramid)
  colors: [string, string];
  leagueId: LeagueId | null;
  population: number; // metro population
  economy: number; // 0.7 - 1.3 purchasing power
  prestige: number; // 0-100
  fans: Fanbase;
  finances: Finances;
  arena: Arena;
  ticketing: Ticketing;
  concessions: Concessions;
  merch: Merch;
  sponsors: SponsorDeal[];
  tv: TvDeal | null;
  campaigns: Campaign[];
  staff: Partial<Record<StaffRole, number>>;
  tactics: Tactics;
  training: { focus: TrainingFocus; intensity: TrainingIntensity };
  board: Board;
  ai: { strategy: AiStrategy; payrollTarget: number; lockedUntil?: number };
  cohesion: number; // 0-100
  rivals: number[];
  sponsorLocks?: Partial<Record<SponsorSlot, number>>; // slot -> abs day until new offers
  logoUrl?: string; // optional licensed logo (overrides the generated emblem)
  facilities?: ClubFacilities;
  history: SeasonRecord[];
  trophies: { season: number; name: string }[];
  retiredNumbers: { jersey: number; playerId: number; name: string }[];
  founded: number;
}

// ---------------------------------------------------------------------------
// Competitions
// ---------------------------------------------------------------------------
export type LeagueId = 'ELITE' | 'ORO' | 'PLATA' | 'COLLEGE';

export interface LeagueRules {
  kind: 'pro' | 'college';
  country: string;
  tier: number; // economic tier (college programs are run on a tier-2 budget scale)
  name: string;
  short: string;
  teams: number;
  rosterMin: number;
  rosterMax: number;
  matchdaySquad: number;
  maxNonEU: number;
  minHomegrown: number;
  minArenaSeats: number; // venue requirement to compete (promotion eligibility)
  promotionFee: number; // entry guarantee / registration
  centralTv: number; // base central distribution per club
  centralTvMerit: number; // extra for 1st place, linear down
  leagueFee: number;
  directPromotion: number;
  playoffPromotion: number; // slots via playoff
  relegation: number;
  playoffTeams: number; // title playoffs (top tier) or promotion playoff entrants
  prizeChampion: number;
  minPayrollGuarantee: number; // financial standard: cash+guarantee needed for promotion
}

export interface Ruleset {
  version: string;
  season: number;
  leagues: Record<LeagueId, LeagueRules>;
  euro: { teams: number; fromElite: number; prizeParticipation: number; prizePerWin: number; prizeChampion: number; tvShare: number };
  cup: { teams: number; prizeWinner: number; prizeParticipation: number };
  windows: { summerClose: number; winterOpen: number; winterClose: number }; // days in season
}

export interface Standing {
  clubId: number;
  w: number;
  l: number;
  pf: number;
  pa: number;
  home: [number, number];
  away: [number, number];
  streak: number; // +n wins / -n losses
  last10: string[]; // 'W' | 'L'
}

export interface Series {
  id: number;
  compId: string;
  round: string; // 'QF' | 'SF' | 'F' ...
  roundIndex: number;
  bestOf: number;
  highSeed: number; // club id (home court)
  lowSeed: number;
  winsHigh: number;
  winsLow: number;
  winner: number | null;
  fixtureIds: number[];
  neutral: boolean;
}

export interface Competition {
  id: string; // e.g. 'ELITE-2026', 'ORO-PO-2026', 'CUP-2026', 'EURO-2026'
  kind: 'league' | 'playoffs' | 'promo' | 'cup' | 'euro';
  leagueId?: LeagueId;
  name: string;
  season: number;
  clubIds: number[];
  standings: Standing[]; // for league & euro groups (euro: tagged by group)
  groups?: Record<string, number[]>;
  series: Series[];
  stage: string;
  champion: number | null;
  runnerUp: number | null;
  complete: boolean;
  // round dates for knockout
  roundDays?: number[][];
}

export interface Fixture {
  id: number;
  day: number; // season day (0 = Jul 1)
  compId: string;
  comp: CompType;
  round: number;
  label: string;
  homeId: number;
  awayId: number;
  neutral: boolean;
  seriesId: number | null;
  played: boolean;
  cancelled: boolean;
  result: { home: number; away: number; ot: number; attendance: number; gameId: number | null } | null;
}

// ---------------------------------------------------------------------------
// Game logs (user games keep box score + explanation; results are simulated instantly)
// ---------------------------------------------------------------------------
export interface BoxLine extends StatLine {
  playerId: number;
  name: string;
  pos: Position;
  starter: boolean;
  energy: number;
}

export interface TeamBox {
  clubId: number;
  score: number;
  quarters: number[];
  players: BoxLine[];
  totals: StatLine;
  fastBreak: number;
  secondChance: number;
  paint: number;
  bench: number;
  offTov: number;
  biggestLead: number;
  timeouts: number;
  fouls: number;
}

export interface ExplanationFactor {
  title: string;
  detail: string;
  impact: number; // estimated points swing (+ favours user team)
  category: 'rebounding' | 'turnovers' | 'shooting' | 'freeThrows' | 'bench' | 'fouls' | 'fatigue' | 'tactics' | 'star' | 'clutch' | 'transition' | 'homeCourt' | 'injury';
  suggestion?: string;
}

export interface GameLog {
  id: number;
  fixtureId: number;
  day: number;
  season: number;
  compId: string;
  home: TeamBox;
  away: TeamBox;
  ot: number;
  factors: ExplanationFactor[]; // from perspective of userClub
  /** score by minute (lead chart) */
  flow?: { m: number; h: number; a: number }[];
  attendance: number;
  revenue: number;
  mvpId: number;
  leadChanges: number;
}

// ---------------------------------------------------------------------------
// News / media / decisions
// ---------------------------------------------------------------------------
export type NewsTag = 'result' | 'transfer' | 'injury' | 'rumour' | 'board' | 'finance' | 'fans' | 'media' | 'award' | 'milestone' | 'club' | 'career' | 'league' | 'staff' | 'delegation';

export interface NewsItem {
  id: number;
  day: number; // absolute day
  season: number;
  outlet: string;
  headline: string;
  body: string;
  tags: NewsTag[];
  clubIds: number[];
  playerIds: number[];
  importance: number; // 0-3
  read: boolean;
}

export type DecisionKind =
  | 'event'
  | 'transferBid' // incoming bid for our player
  | 'sponsorOffer'
  | 'tvOffer'
  | 'pressConference'
  | 'contractRequest'
  | 'jobOffer'
  | 'boardMessage'
  | 'returnToPlay'
  | 'staffPoach'
  | 'counterOffer'; // AI counter to our bid

export interface DecisionOption {
  id: string;
  label: string;
  detail?: string;
  tone?: 'good' | 'bad' | 'neutral' | 'risky';
}

export interface Decision {
  id: number;
  kind: DecisionKind;
  title: string;
  body: string;
  createdDay: number; // absolute
  deadlineDay: number; // absolute
  urgency: number; // 0-3
  impact: number; // 0-3
  dept: Department;
  options: DecisionOption[];
  recommended: string | null;
  recommendedBy: string | null; // staff name
  payload: Record<string, unknown>;
  defaultOption: string; // chosen on expiry
  resolved: boolean;
  choice?: string;
  playerIds?: number[];
  clubIds?: number[];
}

// ---------------------------------------------------------------------------
// Delegation
// ---------------------------------------------------------------------------
export type Department = 'tactics' | 'transfers' | 'scouting' | 'tickets' | 'sponsors' | 'marketing' | 'media' | 'medical' | 'academy' | 'board';
export const DEPARTMENTS: Department[] = ['tactics', 'transfers', 'scouting', 'tickets', 'sponsors', 'marketing', 'media', 'medical', 'academy'];

export type DelegationMode = 'manual' | 'recommend' | 'policy' | 'notify' | 'full';

export interface DelegationPolicy {
  mode: DelegationMode;
  // generic policy knobs (used per department as relevant)
  maxSalary?: number;
  maxFee?: number;
  minSellMultiple?: number; // accept bids ≥ value × this
  sponsorFloor?: number; // accept sponsor offers ≥ this fraction of benchmark
  excludedCategories?: string[];
  spendCap?: number; // weekly marketing cap
  riskTolerance?: number; // medical 0-100
  ageMin?: number;
  ageMax?: number;
  positions?: Position[];
}

export interface DelegationLogEntry {
  id: number;
  day: number;
  dept: Department;
  staff: string;
  action: string;
  rationale: string;
  expected: string;
}

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------
export interface TransferRecord {
  id: number;
  day: number;
  season: number;
  playerId: number;
  playerName: string;
  fromId: number | null;
  toId: number | null;
  fee: number;
  salary: number;
  kind: 'transfer' | 'freeAgent' | 'loan' | 'release' | 'retire' | 'youth' | 'buyout';
}

export interface ShortlistEntry {
  playerId: number;
  note: string;
  addedDay: number;
}

export interface ScoutAssignment {
  id: number;
  region: 'ESP' | 'EU' | 'NONEU' | 'YOUTH';
  focusPos: Position | 'any';
  maxAge: number;
  weeksLeft: number;
}

export interface Negotiation {
  playerId: number;
  rounds: number;
  patience: number; // 0-100 remaining
  lastAsk: { salary: number; years: number; role: RolePromise } | null;
  mode: 'sign' | 'renew';
  feeAgreed: number; // transfer fee agreed with club (0 for FA)
  status: 'open' | 'agreed' | 'failed';
}

// ---------------------------------------------------------------------------
// Career / user
// ---------------------------------------------------------------------------
export type UserRole = 'owner' | 'gm';
export type Background = 'formerPlayer' | 'coach' | 'business' | 'analyst';
export type ExecutiveStyle = 'owner' | 'gm' | 'obsessive' | 'custom';

export interface JobOffer {
  id: number;
  clubId: number;
  role: UserRole;
  salary: number;
  years: number;
  expectations: string;
  expiresDay: number;
  reason: string;
}

export interface CareerStint {
  clubId: number;
  clubName: string;
  role: UserRole;
  from: number;
  to: number | null;
  achievements: string[];
  exit: string | null; // 'fired' | 'resigned' | 'left for X'
}

export interface Approval {
  board: number; // owner / board view of you (0-100)
  fans: number; // supporters' view of you (0-100)
  fanBonus: number; // decaying memory of your recent actions (sales, signings, prices)
  lowFanWeeks: number;
  history: { day: number; board: number; fans: number }[];
  notes: { day: number; text: string; delta: number; who: 'fans' | 'board' }[];
}

export interface UserState {
  name: string;
  nationality: string;
  background: Background;
  approval: Approval;
  role: UserRole;
  clubId: number | null;
  reputation: number; // executive reputation 0-100
  personalWealth: number; // owner only
  style: ExecutiveStyle;
  delegation: Record<Department, DelegationPolicy>;
  career: CareerStint[];
  jobOffers: JobOffer[];
  shortlist: ShortlistEntry[];
  scoutAssignments: ScoutAssignment[];
  negotiations: Negotiation[];
  knowledge: Record<number, number>; // playerId -> scouting knowledge 0-100
  pressStance: number; // accumulated media posture
  unemployedSince: number | null;
  declinedOffers?: Record<number, number>;
  onboarding?: { visited: string[]; dismissed: boolean }; // clubId -> abs day until which it won't ask again
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export type HoldKind =
  | 'userGame'
  | 'decision'
  | 'injury'
  | 'boardUltimatum'
  | 'budgetBreach'
  | 'transferBid'
  | 'contractExpiry'
  | 'jobOffer'
  | 'seasonEvent'
  | 'projectComplete'
  | 'windowClose';

export interface Settings {
  worldNoise: 'quiet' | 'normal' | 'handsOn';
  difficulty: 'relaxed' | 'standard' | 'demanding' | 'brutal';
  holds: Record<HoldKind, boolean>;
  seed: number;
  debugDeterministic: boolean;
  textScale?: number; // UI text size multiplier (1 = 100%)
  liveGames?: boolean; // watch your games minute by minute (default on)
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
export interface AwardRecord {
  season: number;
  leagueId: LeagueId | 'EURO' | 'CUP';
  award: string;
  playerId: number | null;
  clubId: number | null;
  name: string;
}

export interface RecordEntry {
  key: string;
  label: string;
  value: number;
  holder: string;
  playerId: number | null;
  clubId: number | null;
  season: number;
}

export interface HoldEvent {
  kind: HoldKind;
  message: string;
  day: number;
}

export interface World {
  version: number;
  saveId: string;
  saveName: string;
  createdAt: number;
  season: number; // 2026 = 2026-27 season
  day: number; // day within season; 0 = Jul 1
  rng: number; // rng state
  rules: Ruleset;
  clubs: Club[];
  players: Player[];
  staff: Staff[];
  competitions: Competition[];
  fixtures: Fixture[];
  games: GameLog[]; // user games (current + previous season)
  news: NewsItem[];
  decisions: Decision[];
  delegationLog: DelegationLogEntry[];
  transfers: TransferRecord[];
  sponsorOffers: Record<number, SponsorOffer[]>; // by club (user mostly)
  tvOffers: TvOffer[];
  projects: Record<number, ArenaProject[]>; // by club
  user: UserState;
  settings: Settings;
  awards: AwardRecord[];
  records: RecordEntry[];
  hallOfFame: { playerId: number; name: string; season: number; summary: string }[];
  nextId: number;
  pendingHolds: HoldEvent[];
  gameOver: { reason: string; day: number } | null;
  scenario: string | null;
  lastWeekSummary: WeekSummary | null;
  pendingMoves: { clubId: number; from: LeagueId; to: LeagueId; reason: string }[];
}

export interface WeekSummary {
  fromDay: number;
  toDay: number;
  cashDelta: number;
  results: { fixtureId: number; text: string; win: boolean }[];
  trustDelta: number;
  fanDelta: number;
  highlights: string[];
}

export function absDay(w: World): number {
  return Math.round((Date.UTC(w.season, 6, 1) - Date.UTC(2000, 6, 1)) / 86400000) + w.day;
}
