# Basketball Dynasty — art request v2 (grid sheets)

The game is played on a tablet, so every sheet is **2048 × 1024 px** and is cut into a grid
by the game. Send one file per sheet with the exact name below; anything you haven't sent
keeps today's drawn-in-code art, so sheets can arrive one at a time and in any order.

## How every sheet works

- **Grid:** cells are equal, edge to edge, no gaps or padding, counted left → right, then top → bottom.
  Keep each drawing about **8 % inside its cell** so nothing touches a neighbour.
- **Background:** transparent PNG unless the sheet says "opaque" (then PNG or JPG is fine).
- **Club colours are added by the game.** For sheets marked *(+ colour map)*, send a second file
  with the same name plus `-map` (for example `bodies-map.png`), same size and grid, painted in
  three flat colours only:
  - pure red `#FF0000` = club main colour (jersey body, scarf stripes, crest field…)
  - pure green `#00FF00` = club second colour (trim, numbers, collar, crest border…)
  - pure blue `#0000FF` = skin
  - transparent = leave as drawn

  On the main sheet, paint those areas in **white / light grey with your shading**, and skin in
  **mid grey with shading**. The game tints them, so one body works for every club and skin tone.
- **Style for all sheets:** clean semi-flat illustration with soft two-tone shading, light from the
  top-left, thin or no outlines. Night-navy and broadcast-orange world (`#0a1530` navy,
  `#ff8a1f` orange, `#36d1ff` cyan accents). No real people, clubs, crests, sponsors or arena names.
- **Weight:** keep each file under ~1.5 MB.

## Priority (what changes the game most)

1. Bodies and faces (every player and coach screen)
2. Venues (Today, live game, postgame — shows the club growing)
3. Shop and food (merchandise and food & drink decisions)
4. Navigation icons and section banners
5. Facilities and emblems

---

## 1. `bodies.png` (+ colour map) — 8 columns × 2 rows, cells 256 × 512

Full standing player, front ¾ view, arms relaxed, in a plain tank top, shorts and shoes. **No
face** (simple head shape; faces come from sheet 2). Feet on the same line in every cell
(about 12 px above the cell bottom) and the **same scale everywhere**, so height differences show:
short ≈ 1.85 m (head top ≈ 22 % down the cell), medium ≈ 2.00 m (≈ 12 %), tall ≈ 2.12 m (≈ 3 %).

| Row | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 1 | short slender | short lean | short athletic | short strong | short heavy | medium slender | medium lean | medium athletic |
| 2 | medium strong | medium heavy | tall slender | tall lean | tall athletic | tall strong | tall heavy | coach in suit (medium, tie = red) |

*Used on:* player cards (squad, market, shortlist), player profile.

## 2. `faces.png` (+ colour map) — 8 columns × 4 rows, cells 256 × 256

Head-and-shoulders busts, facing slightly left, same framing in every cell (chin around the
middle, shoulders to the bottom edge). Every face clearly different: head shape, hairstyle,
beard, ears, brows, a few accessories (headband, goggles, earring, glasses for staff). Hair in
dark natural colours; skin in mid grey (map blue).

| Row | Contents |
|---|---|
| 1–3 | 24 players in tank-top jerseys (map red = jersey, green = collar/trim): mix of buzz, fade, braids, locs, afro, curls, long tied, bald, beards, young and veteran |
| 4 | 8 staff: 4 men in suits (tie = red), 2 women in blazers (scarf or pocket = red), 2 in club polos (polo = red); two of them older, two with glasses |

*Used on:* squad lists, transfer shortlist and market, staff market, staff profiles, live game
"stars to watch", postgame player of the game, Today decisions. The game gives each person one
cell and a skin tone for life, so the same face appears everywhere.

## 3. `venues-outside.png` — opaque, 2 columns × 2 rows, cells 1024 × 512

Evening exterior, wide, with the **bottom third darker and simpler** (text sits on top) and nothing
important in the outer 10 % (it gets cropped on narrow screens).

| | Column 1 | Column 2 |
|---|---|---|
| Row 1 | Municipal pavilion (small brick/concrete sports hall, small car park) | Modern domestic arena (glass and steel, LED ribbon, plaza with fans) |
| Row 2 | Continental showpiece (landmark roof, night crowds, light beams) | New arena under construction (cranes, half-built bowl) |

## 4. `venues-inside.png` — opaque, 2 columns × 2 rows, cells 1024 × 512

Court-level interior during a game, same composition rules.

| | Column 1 | Column 2 |
|---|---|---|
| Row 1 | Municipal: low stands on two sides, basic scoreboard | Modern: full bowl, centre-hung videoboard, LED boards |
| Row 2 | Showpiece: two-tier packed bowl, big videoboard, light show | Celebration: confetti, trophy on court (used for titles and promotion) |

*Used on:* Today header (outside), live game and postgame (inside), title/promotion moments.
The tier follows your arena: under 5,000 seats, 5,000–11,999, 12,000+.

## 5. `shop.png` (+ colour map) — 4 columns × 2 rows, cells 512 × 512

| Row | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| 1 | Home jersey, flat-lay (body = red, trim/number = green) | Away jersey, different collar (body = green, trim = red) | Knitted bar scarf (stripes red/green) | Snapback cap (crown = red, brim = green) |
| 2 | Rubber crest keychain (red) | Family kiosk: hot dogs, popcorn, drinks counter | Local grill: open flame, wooden counter | Premium lounge: seated tables overlooking the court |

Food cells are small scenes on a transparent background (an awning, counter or table cluster),
not full rectangles; awning/tablecloth can be red in the map.

*Used on:* Merchandise product rows, order window, store stock; Food & Drink outlet cards and the
postgame food report.

## 6. `icons.png` — 8 columns × 4 rows, cells 256 × 256

Navigation icons, **solid white on transparent** (the game colours them), bold simple shapes
that still read at 24 px.

| Row | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 1 | Today | Calendar | Club | Team | Infrastructure (arena) | Results | Legacy | Settings |
| 2 | Players | Tactics | Training | Coaching staff | Medical | Transfer market | Academy | Contracts |
| 3 | Finance | Marketing (megaphone) | Board | News | Sponsors (coin) | Tickets | Merchandise (store) | Food & drink |
| 4 | Standings | Fixtures | Bracket | Statistics | Rules | Trophy | Owner | Fans |

*Used on:* the side rail, section tiles, hub headers, search results. Small controls (close,
arrows, play, search) stay drawn in code.

## 7. `banners.png` — opaque, 2 columns × 4 rows, cells 1024 × 256

Wide section header art, mood pieces with no text, darker on the left half (titles sit there).

| | Column 1 | Column 2 |
|---|---|---|
| Row 1 | Today (executive desk at night, arena through the window) | Calendar (schedule board, fixtures) |
| Row 2 | Club (boardroom, money, partners) | Team (locker room, jerseys hanging) |
| Row 3 | Infrastructure (arena blueprint, cranes) | Results (scoreboard, standings wall) |
| Row 4 | Legacy (trophy cabinet) | Main menu / title (arena tunnel, spotlight) |

## 8. `facilities.png` — 8 columns × 4 rows, cells 256 × 256

Small isometric buildings or objects, same angle and scale feel.

| Row | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 1 | Arena team store | City-centre store | Outlet store | Airport kiosk | Online store (laptop + parcel) | Concession stands | Restaurant & bar | VIP lounge |
| 2 | Practice gym | Medical & rehab centre | Academy residence | Locker room | Analytics lab | Corporate offices | PR office / press room | Boardroom |
| 3 | Seating expansion | Videoboard | Corporate suites | Access & transit | Parking & fan zone | Renovation (scaffold) | Licence stands (modular seating) | Ground-share venue |
| 4 | Construction crane | Warehouse (stock) | Delivery truck (orders) | Supplier factory | Ticket office | Scouting (binoculars) | Youth court | Bank / loan |

*Used on:* Infrastructure hub and tabs, store cards, project lists, the licence page, orders.

## 9. `emblems.png` (+ colour map) — 8 columns × 4 rows, cells 256 × 256

Pieces the game combines into each fictional club's crest, plus trophies.

| Row | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 1 | Shield frame | Roundel frame | Hexagon frame | Badge frame | Diamond frame | Ball | Star | Crown |
| 2 | Wave | Mountain | Tower | Flame | Wing | Anchor | Tree | Lightning bolt |
| 3 | Sun | Shield charge | Helmet | Horns | Paw | Eye | Pickaxe | Wheel |
| 4 | Leaf | League trophy | Copa trophy | Continental cup | Promotion medal | MVP award | Coach of the year | Champions ribbon |

Frames: field = red, border = green in the map. Symbols (rows 1–4 after the frames): solid white
on transparent (tinted by the game). Trophies: full colour (gold/silver), no map needed.

*Used on:* every club crest (unless you uploaded a real logo in the club editor), trophy cabinet,
season awards, titles.

---

## Not needed

- **Buttons, panels, tabs, sliders:** kept in code so they stay sharp at any size and follow the
  theme; no art required.
- **The interactive arena model** (planning view with hotspots) stays drawn in code.
- **Real logos:** use the club editor (Settings → Club editor) to upload your own per club.

## Delivery

Put the files in `public/art/` (or send them in a zip). Names: `bodies.png`, `bodies-map.png`,
`faces.png`, `faces-map.png`, `venues-outside.png`, `venues-inside.png`, `shop.png`,
`shop-map.png`, `icons.png`, `banners.png`, `facilities.png`, `emblems.png`, `emblems-map.png`.

## Status

All nine sheets were delivered (November 2026) and are in `public/art/`. Shop, faces and emblems
had the key colours painted straight onto the art, which works too. To replace or update a sheet,
put the new file (same name, `.png`) in a folder and run
`python3 scripts/prepare-art.py <folder>`. It resizes the sheet to the exact grid, splits painted
key colours into a shaded base plus a map, and compresses everything for tablets.
