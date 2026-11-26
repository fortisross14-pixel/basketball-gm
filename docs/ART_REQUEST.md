# Basketball Dynasty — art request (v1)

One request covering three packs. The game already ships with procedural fallbacks for every
slot below, so you can deliver packs (or even single files) in any order: drop the files into
`public/art/` with the exact names, and the game picks them up on the next build. Anything
missing keeps using the current fallback.

## Shared style reference (applies to every asset)

- **Look:** clean semi-flat vector illustration with soft two-tone cel shading, light from the
  top-left, no outlines (or hairline outlines ≤ 2 px at the delivered size). Think "premium
  sports broadcast graphics package", not photo-real and not cartoon.
- **Palette:** night navy base `#050b1d` / `#0a1530` / `#1b2f6b`, broadcast orange accent
  `#ff8a1f`, electric cyan highlight `#36d1ff`, gold `#ffd23f` for trophies only. Keep
  everything else neutral (greys, warm wood, concrete) so club colours can be tinted on top.
- **Club colours are applied by the game**, never painted in. Wherever a club colour appears
  you deliver a separate **mask** (white = tint, transparent = none) plus a neutral base.
- **No real people, real club crests, real sponsor logos or real arena names.** Generic
  signage only ("ARENA", "TICKETS", numbers).
- **Formats:** backdrops as `.webp` (quality ~80) plus a `.jpg` fallback; everything with
  transparency as **PNG-32 (sRGB, straight alpha)**. File names: lowercase, kebab-case, exactly
  as listed.

---

## Pack 1 — Arena backdrops (progress you can see)

Shown behind the Today header (exterior) and behind the matchday scoreboard / live game
(interior). The game picks the tier from the club's arena: municipal (< 5,000 seats),
modern domestic (5,000–11,999), continental showpiece (12,000+ or a new arena build).

| File | Size / ratio | Where it appears | Notes |
|---|---|---|---|
| `arena/municipal-exterior.webp` | 2560 × 1080 (21:9) | Today hero | Modest brick/concrete municipal pavilion, small car park, evening light |
| `arena/municipal-interior.webp` | 2560 × 1080 (21:9) | Matchday / live game | Low stands on two sides, wooden court, basic scoreboard |
| `arena/modern-exterior.webp` | 2560 × 1080 | Today hero | Glass-and-steel domestic arena, LED ribbon, plaza with fans |
| `arena/modern-interior.webp` | 2560 × 1080 | Matchday | Full bowl, centre-hung videoboard, LED boards |
| `arena/showpiece-exterior.webp` | 2560 × 1080 | Today hero | Landmark continental arena, dramatic roof, night, crowds |
| `arena/showpiece-interior.webp` | 2560 × 1080 | Matchday | Two-tier packed bowl, big videoboard, light show |
| `arena/<same-name>-mask.png` (one per file above) | same size | tinted in club colours | White where seats / banners / LED should take the club primary colour |

Composition rules: keep the **centre 60 % of the width** free of important detail (UI sits on
top), keep the **bottom third darker** (text sits there), horizon at ~40 % height. The game
also crops these to 16:9 and to 9:16 for phones, centred, so nothing essential near the edges.

---

## Pack 2 — Player & coach portraits (modular, recognisable, club-coloured kits)

One person = one combination of parts, generated once and stored in the save, so the same
face appears in the squad list, transfer shortlist, staff market and postgame.

**Canvas:** every part is a **512 × 640 px (4:5) transparent PNG on the same canvas, aligned to
the same anchor** (chin at x = 256, y = 400; shoulders span roughly y = 470–640). Head-and-
shoulders framing, facing ¾ to the viewer's left.

**Recolouring:** skin and hair parts are delivered in **neutral greyscale** (mid-grey ≈ 50 %
for the base tone, darker shading, lighter highlights); the game tints them with 6 skin tones
and 8 hair colours using multiply + screen. Kits use masks as described.

| Part (files) | Count | Notes |
|---|---|---|
| `portrait/body-{slender,lean,athletic,strong,heavy}.png` | 5 | Neck, shoulders, arms to mid-bicep, greyscale skin |
| `portrait/head-01.png` … `head-12.png` | 12 | Head shape + ears, greyscale skin, no features |
| `portrait/eyes-01` … `eyes-10.png` | 10 | Full colour whites/irises are fine (dark irises), includes eyelids |
| `portrait/brows-01` … `brows-08.png` | 8 | Greyscale (tinted with hair colour) |
| `portrait/nose-01` … `nose-10.png` | 10 | Greyscale skin shading only |
| `portrait/mouth-01` … `mouth-10.png` | 10 | Neutral / slight smile / serious |
| `portrait/hair-01` … `hair-24.png` | 24 | Greyscale; include shaved, buzz, fade, braids, locs, afro, long tied, receding, bald (empty file allowed) |
| `portrait/beard-01` … `beard-10.png` | 10 | Greyscale; stubble, goatee, full beard, moustache |
| `portrait/extra-{headband,goggles,glasses-1,glasses-2,earring}.png` | 5 | Full colour, optional accessories |
| `portrait/kit-jersey-{frame}-base.png` | 5 | Player tank top shading in neutral grey, one per body frame |
| `portrait/kit-jersey-{frame}-primary.png` | 5 | Mask: jersey body |
| `portrait/kit-jersey-{frame}-trim.png` | 5 | Mask: collar and arm trim (club secondary colour) |
| `portrait/coach-suit-{frame}-base.png` + `-tie.png` (mask) | 5 + 5 | Dark suit, white shirt, tie tinted club primary |
| `portrait/coach-polo-{frame}-base.png` + `-primary.png` (mask) | 5 + 5 | Club training polo for assistants / staff |

**Layer order (bottom → top):** body, kit/outfit base, kit masks, head, ears/nose/mouth/eyes,
brows, beard, hair, extras.
**If you prefer sprite sheets:** one sheet per part type, cells exactly 512 × 640, 8 columns,
left-to-right then top-to-bottom, no padding, named `portrait/sheet-<part>.png`, plus a
one-line text file stating the cell count.

---

## Pack 3 — Shop & food art (used in the merchandise and food & drink decisions)

| File | Size | Where it appears | Notes |
|---|---|---|---|
| `shop/jersey-home-base.png` + `-primary.png` + `-trim.png` | 512 × 512 (1:1) transparent | Product cards, order dialog, store shelves | Front view, flat-lay, masks for club colours |
| `shop/jersey-away-base.png` + `-primary.png` + `-trim.png` | 512 × 512 | same | Alternate cut/collar so home and away read differently |
| `shop/scarf-base.png` + `-primary.png` + `-trim.png` | 512 × 512 | same | Knitted bar scarf, diagonal |
| `shop/keychain-base.png` + `-primary.png` | 512 × 512 | same | Rubber crest-shaped keychain, generic shield |
| `shop/cap-base.png` + `-primary.png` + `-trim.png` | 512 × 512 | same | Snapback, ¾ view |
| `food/kiosk.webp` | 1600 × 900 (16:9) | Food & Drink concept card, postgame food report | Bright family kiosk: hot dogs, popcorn, soft drinks, quick queue |
| `food/grill.webp` | 1600 × 900 | same | Local-food grill: open flame, regional dishes, wooden counter, warm light |
| `food/lounge.webp` | 1600 × 900 | same | Premium dining / hospitality lounge overlooking the court, seated tables |
| `food/kiosk-icon.png`, `food/grill-icon.png`, `food/lounge-icon.png` | 256 × 256 transparent | Lists, Today alerts, arena hotspot | Simple emblem of each concept |

---

## Delivery

Put the files under `public/art/` keeping the folders above (`arena/`, `portrait/`, `shop/`,
`food/`) and push them, or send them as a zip. You don't need to deliver everything at once;
the game checks each file on its own.
