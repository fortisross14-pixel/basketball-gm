# Competitions plan

## Where we are today

The game has seven competitions, now under their real names:

| Competition | What it is in the game |
|---|---|
| Liga ACB | Spanish 1st division, 16 clubs, playoffs |
| Primera FEB | 2nd division (formerly LEB Oro), promotion playoff |
| Segunda FEB | 3rd division (formerly LEB Plata), promotion playoff |
| Copa del Rey | Top 8 of the ACB at halfway, four-day knockout |
| EuroCup | Top ACB clubs plus invited European clubs; groups, then a Final Four |
| NCAA Division I | One 16-team US college league plus its tournament |
| Promotion playoffs | Between the Spanish divisions |

Foreign clubs only exist to play the EuroCup. They have no league of their own, which makes Europe feel empty and the transfer market thin.

## Goal

Around **60 competitions**: a full Spanish pyramid, the real European club competitions, the big foreign leagues (so foreign clubs live a real season), the US (NBA, G League, NCAA conferences), youth and pre-season events, and national-team windows that take players away.

## How it works behind the scenes

- **Competitions become data.** Each one is a short definition: name, country, number of clubs, format (round-robin, groups then knockout, conferences, Final Four), dates, prize money, TV money, and who goes up, down or into Europe. Adding a competition is then a matter of writing a definition, not new code.
- **Two levels of simulation.** Leagues you can reach (Spain, Europe, wherever your club plays) are played game by game, as today. Distant leagues use a fast results-only simulation, so dozens of competitions don't slow the weekly "play" button.
- **One shared calendar.** Weekends for domestic leagues, Tuesday to Friday for European nights, cup weeks, national-team windows. Clashes are resolved automatically and show up as fatigue and rotation decisions.
- **Qualification links.** League positions feed the next season's European places, the cups and promotion or relegation, exactly as in real life.

## Phases

### Phase 1: the full Spanish pyramid (about 12 competitions)

- Liga ACB grows to 18 clubs: regular season, playoffs and the ACB Final.
- Primera FEB grows to 18 clubs: regular season, direct promotion for 1st place, playoff for 2nd to 9th.
- Segunda FEB: two regional groups with a promotion phase.
- **Tercera FEB** (new, 4th tier): regional groups, so a founder career can start right at the bottom.
- **Supercopa Endesa** (new): ACB champion, Copa del Rey winner, host and runner-up, in September.
- **Copa Princesa de Asturias** (new): Primera FEB's cup, with a place in the ACB as a possible reward.
- **Copa España** (new): the Segunda and Tercera FEB cup.
- Copa del Rey stays: the top 8 at halfway, in February.
- Mini Copa and junior championships (see Phase 5).

### Phase 2: European club competitions (about 8 competitions)

- **EuroLeague**: 18 to 20 clubs, double round-robin, play-in, best-of-5 playoffs, Final Four.
- **EuroCup**: 20 clubs in two groups, then a knockout and a final.
- **Basketball Champions League**: qualifying rounds, groups, Round of 16 groups, play-offs, Final Four.
- **FIBA Europe Cup**: qualifying, groups, knockout.
- **Qualifying rounds** for the BCL and the Europe Cup in September.
- **FIBA Intercontinental Cup**: BCL winner against the champions of the Americas, Africa and Asia.
- Licence and arena rules per competition (minimum seats, budget), which makes infrastructure matter.

### Phase 3: foreign national leagues (about 25 competitions)

Every European club gets a real league and cup, giving the market real buyers and sellers.

| Country | League | Cups |
|---|---|---|
| Italy | Lega Basket Serie A | Coppa Italia, Supercoppa |
| France | LNB Élite | Coupe de France, Leaders Cup |
| Germany | Basketball Bundesliga | BBL-Pokal |
| Greece | Greek Basket League | Greek Cup |
| Turkey | Basketbol Süper Ligi | Turkish Cup |
| Lithuania | LKL | King Mindaugas Cup |
| Adriatic region | ABA League | ABA Supercup |
| Israel | Winner League | State Cup |
| Portugal | Liga Portuguesa | Taça de Portugal |
| Poland | PLK | Polish Cup |
| Belgium & Netherlands | BNXT League | — |
| Czechia | NBL | — |

These leagues use the fast simulation unless your club plays there.

### Phase 4: the Americas and the rest of the world (about 12 competitions)

- **NBA**: regular season, NBA Cup, play-in, playoffs. Used by coach careers and for the draft and buy-outs.
- **NBA G League** and **NBA Summer League**, where your young players can be showcased and US players scouted.
- **NCAA Division I** split into real conferences (ACC, Big Ten, Big 12, SEC, Big East, plus mid-majors), conference tournaments, March Madness (68 teams) and the NIT.
- Leagues mainly for the market and coach careers, with fast simulation: Liga Nacional (Argentina), NBB (Brazil), NBL (Australia), B.League (Japan), CBA (China).

### Phase 5: youth, pre-season and national teams (about 8 competitions)

- **Adidas Next Generation Tournament** (EuroLeague U18) and the Spanish junior and cadet championships: showcases for your academy.
- **Mini Copa** alongside the Copa del Rey.
- Pre-season invitational tournaments (these connect to the new event planner and training camps).
- **National-team windows**: EuroBasket, World Cup and Olympic qualifiers in November and February, and summer tournaments. Players leave, come back tired or injured, and gain value if they shine.

## Order and effort

1. Phase 1 (Spain) and Phase 2 (Europe) together: the biggest gain for your career. About two to three sessions, including the switch to data-defined competitions.
2. Phase 3 (foreign leagues): mostly data plus the fast simulation. One to two sessions.
3. Phases 4 and 5: one to two sessions each.

## A note on names

The real competition names are trademarks of their organisers (ACB, FEB, Euroleague Basketball, FIBA, the NBA, the NCAA). That is fine for a private game. If the game is ever published or sold, they would need licences or a switch back to invented names, so all names live in one data file, which makes swapping them a single edit.
