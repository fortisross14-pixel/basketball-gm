# Basketball Dynasty

A single-player basketball **club-management** game in the spirit of PC Fútbol: take a modest club in the lower divisions, make the turnstiles work, make payroll, find undervalued players and coaches, improve the arena, and climb to the top tier and continental competition — or get fired trying.

Every system is in and playable end to end, with a broadcast-style **visual pass** (dark arena theme, condensed italic display type, generated club emblems, MyTeam-style player cards, animated transitions and result reveals). The **balance pass** comes next.

## Running

```bash
npm install
npm run dev        # http://localhost:5173 (live build: https://fortisross14-pixel.github.io/basketball-gm/)
npm test           # engine regression tests (vitest)
npm run build      # production build in dist/
```

Saves live in the browser (IndexedDB, with persistent storage requested) and autosave after every advance; the title screen shows where saves are stored and how much space they use. You can export/import a save file from **Settings & Saves**.

The game is an installable app (PWA): use **Install app** on the title screen or Today, and it works offline after the first visit.

## How a career plays

- **Create your profile:** name, nationality and background (former player, former coach, business executive, data analyst — each with a small edge).
- **Your first offers depend on where you come from.** Spaniards get offers from the Spanish third and second divisions; Americans from struggling US college programs (the fictional National Collegiate League); other nationalities get a mix. Accept one, or decline and wait.
- **The owner and the fans grade you every week**, against what *your* club is expected to achieve (not in absolute terms). The owner weighs objectives, finances, promises and the relationship; fans weigh results vs expectations, their mood (prices, atmosphere) and your decisions (selling favourites, exciting signings, listening to protests). See Club → Board → *Your evaluation*.
- **Transfers:** bid, negotiate, loan, release — or **quick-sell** a player: a club pays about 40% of his value the next day, guaranteed.
- **Friendlies:** arrange them from the Calendar (opponent, home/away, appearance fees); they build squad chemistry without affecting standings.
- **Players** have no faces yet, but each has a body figure (frame, height, skin tone) on their card.
- **Get fired or get poached.** Poor ratings bring warnings, an ultimatum, fan protests and dismissal (mid-season under sustained fan pressure, or at the season review). Strong ratings raise your executive reputation and bring offers from bigger clubs — at season's end and even mid-season. After a dismissal you start again from equal or smaller jobs. You can also resign.

- **Watch your games live.** The clock stops on game day and the game plays one quarter at a time, a game minute per tick (speed ½×–4×), with a broadcast scoreboard, play-by-play, live leaders and a +/− lead chart by minute. It stops at every quarter break, where you can change systems, pace and emphasis for the next quarter (each quarter is genuinely simulated when you press play). Skip to the final at any time, or switch live games off in Settings. Every other game is simulated instantly, possession by possession. Every game ends with a **"Why we won / lost"** report.
- **The weekly loop:** Monday digest → decisions (offers, bids, events, press) → games → cash, fans and board react. Use **Play next game**, or the dropdown to advance a day, a week, a month, to the next event, or to the end of the season. Calendar holds (Settings) decide what stops the clock.
- **Climb the pyramid:** Liga Plata → Liga Oro → Liga Élite (16 clubs each, 30 rounds) plus the Copa, title playoffs, promotion playoffs and the Continental Cup. In the US college league there is no promotion: you recruit high-school classes (NIL money matters less than playing time, coach and program prestige), players graduate after their eligibility or declare early for the pros, and the season ends with the 8-team NCL Tournament. Promotion is **licensed**: your arena must meet the next league's capacity and you must be able to pay its entry guarantee, or the place goes to someone else.
- **Career mobility:** as General Manager the board can dismiss you; success raises your executive reputation and brings job offers from bigger clubs. As Owner-President you can't be fired but administration ends your career.

## Sections

| Section | What's there |
|---|---|
| **Today** | Executive digest ranked by urgency/impact, decisions with staff recommendations, next game, club snapshot, news |
| **Calendar** | Month view of your fixtures and results, transfer windows, deadlines, Copa, playoffs, youth intake |
| **Club Management** | Finance (P&L, 90-day and 5-year forecasts, loans), Marketing & fans (5 fan segments, campaigns), Sponsors & TV (8 sponsor slots, broadcaster bids), Contracts (payroll sheet, renewals, releases), Board (trust, objectives, promises, requests), News & Media |
| **Navigation** | Every section opens on a hub with a summary and big tiles; subsections have a breadcrumb back to the hub and a sibling switcher |
| **Team** | Players, Tactics (5 offensive systems × 5 defensive schemes with personnel-fit and coach agreement, rotation, sliders, starters, minute limits), Training, Coaching staff, Medical & support, Transfers & scouting, Academy |
| **Infrastructure** | Hub with facility health and works; **Arena** (interactive arena model with hotspots for seating, videoboard, suites, concourse food, access and parking + ticket prices), **Sports facilities** (training ground, academy residence, locker room, medical centre — capacity, usage and a responsible staff owner), **Commercial facilities** (arena, city, outlet, airport and online stores with product lines, prices, stock and a manager; food & drink), **Club facilities** (corporate offices = staff capacity; PR office = press conferences and press relationship) |
| **Results** | Standings, fixtures & results, competitions/brackets, statistics, the versioned ruleset |
| **Legacy** | Your career, trophies, club history, awards, records, Hall of Fame |
| **Settings** | Delegation per department (Manual → Fully delegate, with policies), delegation log, calendar holds, world noise, difficulty, saves |

## Visual pass

- **Theme** (`src/ui/styles.css`): arena-light gradients, glass panels with cut corners, Barlow Condensed italic display type and Inter body text (bundled locally via Fontsource, so the game works offline), orange/electric-blue accents, angled buttons and tabs, glowing call-to-action.
- **Navigation:** icon rail for the main sections, angled sub-tabs per section, HUD top bar (club, date, cash, owner and fan ratings, next opponent, *Play next game*).
- **Art** (`src/ui/art/`): a custom icon set; a procedural SVG emblem for every fictional club (shape, colour pattern and a mascot icon from its nickname); MyTeam-style player cards with rating-tier frames (bronze → diamond) and jersey silhouettes (no faces yet).
- **Logos:** all clubs are fictional, so emblems are generated. Set `logoUrl` on a club (for example from a licensed logo pack) and that image replaces the generated emblem everywhere.
- **Motion** (framer-motion): page transitions, spring modals with exit animations, sliding tab underline, animated menus, staggered cards and table rows, chart draw-in, and a results reveal (crests slide in, score counts up, WIN/LOSS stamp, confetti). Respects the OS reduced-motion setting.

## Code layout

```
src/engine/        pure TypeScript simulation (no UI)
  types.ts         the World data model (one save = one World)
  worldgen.ts      fictional world: 48 domestic + 12 continental clubs, ~1,100 players, staff
  sim/game.ts      possession-level quick-result game engine
  sim/explain.ts   "why we won/lost" causal factors
  economy.ts       demand, ticketing, concessions, merch, sponsors, TV, grants
  finance.ts       ledger, monthly cash flows, loans, statements, forecasts, budgets
  arena.ts         infrastructure projects, maintenance
  market.ts        registration rules, player interest model, negotiation, transfers, AI market
  board.ts         objectives, trust, ultimatums, requests
  commercial.ts    sponsor/TV offers, campaigns, merch sales, season tickets, fan growth
  events.ts        midweek events, press, decision routing & resolution
  delegation.ts    delegation modes, tactical fit, coach & commercial-director automation
  squad.ts         fatigue, morale, training, scouting, academy
  competitions.ts  leagues, playoffs, Copa, Continental Cup
  season.ts        season start/end, awards, licensing, promotion/relegation, rollover
  career.ts        job offers, reputation
  daily.ts         the day/week/month clock and advance modes
  rules.ts         data-driven, versioned ruleset
  save.ts          IndexedDB saves, versioned migrations, import/export
src/ui/            React UI (store.ts, App.tsx shell, components/, screens/)
tests/             vitest: sim credibility, schedule validity, rules, negotiation, multi-season run, save/load
```

## Game-dev skills

`.claude/skills/` holds third-party Claude Code skills used to audit this project (save systems, game UI/UX, utility AI, game feel, game docs, game development / game design). They are copied unmodified; sources, commits and licenses are in `.claude/skills/THIRD_PARTY_NOTICES.md`.

All clubs, players, competitions and brands are fictional; Spanish city names are real places, US college programs and towns are invented.
