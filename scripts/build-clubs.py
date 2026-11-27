#!/usr/bin/env python3
"""Build src/engine/data/clubs.ts and public/badges/ from Wikipedia snapshots.

Inputs (made by hand-run fetches, see docs): a work folder with
  leagues.json   club lists of the four Spanish leagues (es.wikipedia season pages)
  clubinfo.json  infobox fields of each club page (es.wikipedia)
  enpages.txt    es page -> en page;  en/*.html English pages (badges live there)
Usage: python3 scripts/build-clubs.py /path/to/workdir
"""
import hashlib, html, io, json, math, os, re, sys, time, unicodedata, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'data'))
from cities import CITIES  # noqa: E402
from world_clubs import NBA, NCAA, EURO  # noqa: E402
from PIL import Image  # noqa: E402

WORK = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BADGES = os.path.join(ROOT, 'public', 'badges')
os.makedirs(BADGES, exist_ok=True)
os.makedirs(os.path.join(WORK, 'logos'), exist_ok=True)
UA = 'BasketballDynastyPersonal/1.0 (private single-user game)'

leagues = json.load(open(os.path.join(WORK, 'leagues.json')))
info = json.load(open(os.path.join(WORK, 'clubinfo.json')))
enmap = {}
for line in open(os.path.join(WORK, 'enpages.txt'), encoding='utf-8'):
    a, _, b = line.rstrip('\n').partition('\t')
    enmap[a] = b


def plain(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', plain(s).lower()).strip('-')[:48]


def en_logo(key):
    f = os.path.join(WORK, 'en', key.replace('/', '_') + '.html')
    if not os.path.exists(f):
        return None
    s = open(f, encoding='utf-8').read()
    m = re.search(r'<td colspan="2" class="infobox-image"[^>]*>(.*?)</td>', s, re.S) or re.search(r'class="infobox-image"[^>]*>(.*?)</td>', s, re.S)
    if not m:
        return None
    src = re.search(r'src="//(?:thumb|upload)\.wikimedia\.org/([^"?]+)', m.group(1))
    if not src or 'Kit_' in src.group(1):
        return None
    return 'https://upload.wikimedia.org/' + html.unescape(src.group(1))


def en_colors(key):
    f = os.path.join(WORK, 'en', key.replace('/', '_') + '.html')
    if not os.path.exists(f):
        return None
    s = open(f, encoding='utf-8').read()
    m = re.search(r'class="infobox-above[^"]*" style="([^"]+)"', s)
    if not m:
        return None
    st = m.group(1)
    bg = re.search(r'background(?:-color)?:\s*(#[0-9A-Fa-f]{6})', st)
    fg = re.search(r'(?<![-\w])color:\s*(#[0-9A-Fa-f]{6})', st)
    bd = re.search(r'border:[^;]*?(#[0-9A-Fa-f]{6})', st)
    b, d, f2 = (x.group(1).lower() if x else None for x in (bg, bd, fg))
    if b in ('#ffffff', '#fefefe'):
        accent = d if d and d not in ('#ffffff', '#000000') else f2
        return [accent, '#ffffff'] if accent else None
    second = d if d and d != b else f2
    return [b, second] if b and second and second != b else None


def fetch_logo(url, name):
    cache = os.path.join(WORK, 'logos', name + '.bin')
    if not os.path.exists(cache):
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': UA})
                data = urllib.request.urlopen(req, timeout=30).read()
                open(cache, 'wb').write(data)
                break
            except Exception as e:  # noqa: BLE001
                print('  logo retry', name, e)
                time.sleep(6)
        time.sleep(1.2)
    if not os.path.exists(cache):
        return None
    try:
        im = Image.open(cache).convert('RGBA')
    except Exception:  # noqa: BLE001
        return None
    im.thumbnail((120, 120), Image.LANCZOS)
    out = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    out.paste(im, ((128 - im.width) // 2, (128 - im.height) // 2), im)
    out.save(os.path.join(BADGES, name + '.webp'), 'WEBP', quality=88, method=6)
    return out


COLOR_WORDS = [
    ('azul marino', '#0b1f4b'), ('azul real', '#1f4fbf'), ('azul celeste', '#6cace4'), ('celeste', '#6cace4'), ('azul', '#0050a0'),
    ('añil', '#3f51b5'), ('blanco', '#ffffff'), ('negro', '#111111'), ('rojo', '#d7182a'), ('verde', '#00843d'), ('lima', '#9acd32'),
    ('amarillo', '#ffd200'), ('naranja', '#f28c00'), ('morado', '#6a2c91'), ('violeta', '#7f3f98'), ('granate', '#7b1e2b'),
    ('burdeos', '#6d0f2a'), ('gris', '#8a8d8f'), ('dorado', '#c9a227'), ('oro', '#c9a227'), ('plata', '#b0b7bf'), ('rosa', '#e75480'),
]


def colors_from_text(t):
    t = (t or '').lower()
    found = []
    for w, hx in COLOR_WORDS:
        i = t.find(w)
        if i >= 0 and hx not in [h for _, h in found]:
            found.append((i, hx))
            t = t[:i] + ' ' * len(w) + t[i + len(w):]
    found.sort()
    hexes = [h for _, h in found]
    if len(hexes) >= 2:
        # put the stronger colour first (white rarely leads a kit)
        if hexes[0] == '#ffffff':
            hexes = hexes[1:] + ['#ffffff']
        return hexes[:2]
    return None


def colors_from_logo(im):
    if im is None:
        return None
    small = im.resize((48, 48))
    counts = {}
    for r, g, b, a in small.getdata():
        if a < 128:
            continue
        mx, mn = max(r, g, b), min(r, g, b)
        if mx > 235 and mn > 225:
            continue  # white background
        q = (r // 32, g // 32, b // 32)
        counts[q] = counts.get(q, 0) + 1
    if not counts:
        return None
    ranked = sorted(counts.items(), key=lambda x: -x[1])
    def hx(q):
        return '#%02x%02x%02x' % tuple(min(255, v * 32 + 16) for v in q)
    first = ranked[0][0]
    second = next((q for q, _ in ranked[1:] if sum(abs(a - b) for a, b in zip(q, first)) >= 4), None)
    return [hx(first), hx(second) if second else '#ffffff']


def hashed_colors(name):
    h = int(hashlib.md5(name.encode()).hexdigest(), 16)
    palette = ['#c8102e', '#0050a0', '#00843d', '#f28c00', '#6a2c91', '#111111', '#7b1e2b', '#0b1f4b', '#ffd200', '#6cace4']
    a = palette[h % len(palette)]
    b = ['#ffffff', '#111111', '#ffd200'][(h >> 5) % 3]
    return [a, b if b != a else '#ffffff']


def num(s):
    m = re.search(r'(\d[\d .,]*\d|\d)', s or '')
    if not m:
        return None
    v = int(re.sub(r'\D', '', m.group(1)))
    return v if 80 <= v <= 40000 else None


def year(s):
    m = re.search(r'(1[89]\d\d|20[0-2]\d)', s or '')
    return int(m.group(1)) if m else None


ECON = {'País Vasco': 1.15, 'Navarra': 1.1, 'Madrid': 1.12, 'Cataluña': 1.08, 'Baleares': 1.05, 'Aragón': 1.0, 'La Rioja': 1.0, 'Cantabria': 0.95,
        'Asturias': 0.95, 'Castilla y León': 0.93, 'C. Valenciana': 0.95, 'Galicia': 0.92, 'Murcia': 0.9, 'Canarias': 0.92, 'Andalucía': 0.88,
        'Castilla-La Mancha': 0.88, 'Extremadura': 0.85, 'Ceuta': 0.85, 'Melilla': 0.85, 'Andorra': 1.15}

# ACB: hand-set abbreviations, stature and the city where the infobox has none
ACB = {
    'Real Madrid': ('RMB', 97, 'Madrid'), 'Barça': ('BAR', 95, 'Barcelona'), 'Valencia Basket': ('VBC', 88, 'Valencia'), 'Kosner Baskonia': ('BKN', 86, 'Vitoria-Gasteiz'),
    'Unicaja': ('UNI', 85, 'Málaga'), 'La Laguna Tenerife': ('TEN', 80, 'La Laguna'), 'UCAM Murcia': ('UCM', 76, 'Murcia'), 'Asisa Joventut': ('JOV', 74, 'Badalona'),
    'Casademont Zaragoza': ('ZAR', 68, 'Zaragoza'), 'Surne Bilbao': ('BIL', 68, 'Bilbao'), 'Río Breogán': ('BRE', 64, 'Lugo'), 'Kids&Us Manresa': ('MAN', 64, 'Manresa'),
    'Recoletas Salud San Pablo Burgos': ('SPB', 63, 'Burgos'), 'Monbus Obradoiro': ('OBR', 62, 'Santiago de Compostela'), 'FIATC Girona': ('GIR', 62, 'Girona'),
    'Leyma Coruña': ('COR', 60, 'La Coruña'), 'MoraBanc Andorra': ('AND', 60, 'Andorra la Vella'), 'iLerna Lleida': ('LLE', 58, 'Lérida'),
}
PFEB_PRESTIGE = {'Cajasiete Gran Canaria': 58, 'Movistar Estudiantes': 56, 'Covirán Granada': 50, 'Partizán de Fuenlabrada': 48, 'HLA Alicante': 45,
                 'Iberolea Palencia': 44, 'Inveready Askatuak Gipuzkoa': 42, 'Bàsquet Menorca': 42, 'Alimerka Oviedo Baloncesto': 42, 'Club Ourense Baloncesto': 40,
                 'Insolac Caja 87': 40, 'Grupo Alega Cantabria': 38, 'Grupo Ureta Tizona Burgos': 37, 'Cajasol Coto Córdoba': 36, 'Fibwi Mallorca Bàsquet Palma': 36,
                 'Caja Rural CB Zamora': 34, 'Bueno Arenas Albacete Basket': 34, 'Palmer Basket Mallorca Palma': 32}

used_abbrev = set()
STOP = {'SAN', 'SANTA', 'LA', 'EL', 'LOS', 'LAS', 'DE', 'DEL', 'CB', 'CD', 'CE', 'BC', 'CLUB', 'BASKET', 'BASQUET', 'BALONCESTO', 'UNIVERSIDAD'}


def abbrev_for(name, city):
    words = [w for w in re.findall(r'[A-Za-z]+', plain(city).upper()) if w not in STOP] or ['X']
    base = words[0]
    cands = [base[:3]]
    if len(words) > 1:
        cands.append(base[0] + words[1][:2])
    cands += [base[0] + base[2:4], base[:2] + base[-1], base[0] + base[1] + base[3:4]]
    nw = [w for w in re.findall(r'[A-Za-z]+', plain(name).upper()) if w not in STOP and len(w) > 2]
    cands += [w[:3] for w in nw]
    for c in cands:
        if len(c) == 3 and c not in used_abbrev:
            used_abbrev.add(c)
            return c
    i = 2
    while f'{base[:2]}{i}' in used_abbrev:
        i += 1
    used_abbrev.add(f'{base[:2]}{i}')
    return f'{base[:2]}{i}'


def clean_arena(s):
    s = re.sub(r'\(.*?\)', '', s or '').strip(' ,')
    return s[:48] or None


def nick(i, name, city):
    a = (i.get('Apodo(s)') or '').split(',')[0].split('/')[0].strip(' "«»')
    a = re.sub(r'\(.*?\)', '', a).strip()
    return a[:24] if 1 < len(a) <= 24 else city


seeds = []


def city_of(x, i):
    c = x.get('city')
    if c:
        return c
    loc = (i.get('Ubicación') or '').split(',')[0].strip()
    return loc or 'España'


def add(x, league, tier_default_seats, prestige, group=None, abbrev=None, city=None):
    i = info.get(x.get('page') or '', {})
    city = city or city_of(x, i)
    region, pop = CITIES.get(city, (None, None))
    if region is None:
        region, pop = 'España', 25000
        print('  ! unknown city', city, x['name'])
    name = x['name']
    sl = slug(name)
    logo_im = None
    logo = None
    page = x.get('page')
    en_cols = en_colors(page) if page and page in enmap else None
    if page and page in enmap:
        u = en_logo(page)
        if u:
            logo_im = fetch_logo(u, sl)
            if logo_im is not None:
                logo = f'badges/{sl}.webp'
    colors = en_cols or colors_from_text(i.get('Colores')) or colors_from_logo(logo_im) or hashed_colors(name)
    seats = num(x.get('cap')) or num(i.get('Capacidad')) or int(max(tier_default_seats * 0.6, min(tier_default_seats * 2.5, pop / 50)) // 50 * 50)
    seeds.append({
        'name': name, 'nickname': nick(i, name, city), 'abbrev': abbrev or abbrev_for(name, city), 'city': city, 'region': region, 'country': 'AND' if region == 'Andorra' else 'ESP',
        'population': pop, 'economy': ECON.get(region, 0.9), 'prestige': prestige, 'colors': colors,
        'arena': clean_arena(x.get('arena')) or clean_arena(i.get('Estadio cubierto')) or f'Pabellón de {city}', 'seats': seats,
        'league': league, 'group': group, 'logo': logo, 'founded': year(i.get('Fundación')),
    })


for x in leagues['ACB']:
    ab, pr, city = ACB[x['name']]
    used_abbrev.add(ab)
for x in leagues['ACB']:
    ab, pr, city = ACB[x['name']]
    add(x, 'ELITE', 6000, pr, abbrev=ab, city=city)
    print('ACB', x['name'])
for x in leagues['PFEB']:
    add(x, 'ORO', 3000, PFEB_PRESTIGE.get(x['name'], 38))
    print('PFEB', x['name'])
for x in leagues['SFEB']:
    region, pop = CITIES.get(x.get('city'), ('', 25000))
    pr = int(max(16, min(32, 19 + 4 * math.log10(max(pop, 5000) / 20000) + (int(hashlib.md5(x['name'].encode()).hexdigest(), 16) % 5))))
    add(x, 'PLATA', 1500, pr, group=x.get('group') or 'A')
    print('SFEB', x['name'])
for x in leagues['TFEB']:
    region, pop = CITIES.get(x.get('city'), ('', 15000))
    pr = int(max(6, min(20, 9 + 3 * math.log10(max(pop, 3000) / 10000) + (int(hashlib.md5(x['name'].encode()).hexdigest(), 16) % 5))))
    add(x, 'TERCERA', 600, pr, group=x.get('group') or (x.get('conf', 'A') + '1'))
print('Spanish clubs', len(seeds))

for (name, nickname, ab, city, region, pop, econ, pr, cols, arena, seats, grp, page) in NBA:
    u = en_logo('nba:' + page)
    sl = 'nba-' + slug(name)
    im = fetch_logo(u, sl) if u else None
    seeds.append({'name': name, 'nickname': nickname, 'abbrev': ab, 'city': city, 'region': region, 'country': 'USA' if region != 'Ontario' else 'CAN', 'population': pop, 'economy': econ,
                  'prestige': pr, 'colors': cols, 'arena': arena, 'seats': seats, 'league': 'NBA', 'group': grp, 'logo': f'badges/{sl}.webp' if im is not None else None, 'founded': None})
for (name, nickname, ab, city, region, pop, pr, cols, arena, seats, conf, page) in NCAA:
    u = en_logo('ncaa:' + page)
    sl = 'ncaa-' + slug(name)
    im = fetch_logo(u, sl) if u else None
    seeds.append({'name': name, 'nickname': nickname, 'abbrev': ab, 'city': city, 'region': region, 'country': 'USA', 'population': pop, 'economy': 1.0,
                  'prestige': pr, 'colors': cols, 'arena': arena, 'seats': seats, 'league': 'COLLEGE', 'group': conf, 'logo': f'badges/{sl}.webp' if im is not None else None, 'founded': None})
for (name, nickname, ab, city, region, country, pop, econ, pr, cols, arena, seats, page) in EURO:
    u = en_logo('eu:' + page)
    sl = 'eu-' + slug(name)
    im = fetch_logo(u, sl) if u else None
    seeds.append({'name': name, 'nickname': nickname, 'abbrev': ab, 'city': city, 'region': region, 'country': country, 'population': pop, 'economy': econ,
                  'prestige': pr, 'colors': cols, 'arena': arena, 'seats': seats, 'league': 'FOREIGN', 'group': None, 'logo': f'badges/{sl}.webp' if im is not None else None, 'founded': None})

# names must be unique (club packs key on them)
seen = {}
for s in seeds:
    if s['name'] in seen:
        s['name'] = f"{s['name']} ({s['city']})"
    seen[s['name']] = 1


def ts(v):
    return json.dumps(v, ensure_ascii=False)


lines = ["// Real clubs, generated by scripts/build-clubs.py from Wikipedia (2026-27 season line-ups).",
         "// Badges live in public/badges/. Clubs with no badge get a generated emblem in their colours.",
         "import type { LeagueId } from '../types';", "",
         "export interface ClubSeed {", "  name: string;", "  nickname: string;", "  abbrev: string;", "  city: string;", "  region: string;", "  country: string;",
         "  population: number;", "  economy: number;", "  prestige: number;", "  colors: [string, string];", "  arena: string;", "  seats: number;",
         "  league: LeagueId | 'FOREIGN'; // FOREIGN = European cup club with no league of its own",
         "  group?: string; // group / conference inside a grouped league", "  logo?: string; // badge file (public/badges/…), resolved against the site base",
         "  founded?: number;", "}", "", "export const CLUB_SEEDS: ClubSeed[] = ["]
for s in seeds:
    parts = [f"name: {ts(s['name'])}", f"nickname: {ts(s['nickname'])}", f"abbrev: {ts(s['abbrev'])}", f"city: {ts(s['city'])}", f"region: {ts(s['region'])}",
             f"country: {ts(s['country'])}", f"population: {s['population']}", f"economy: {s['economy']}", f"prestige: {s['prestige']}", f"colors: {ts(s['colors'])}",
             f"arena: {ts(s['arena'])}", f"seats: {s['seats']}", f"league: {ts(s['league'])}"]
    if s.get('group'):
        parts.append(f"group: {ts(s['group'])}")
    if s.get('logo'):
        parts.append(f"logo: {ts(s['logo'])}")
    if s.get('founded'):
        parts.append(f"founded: {s['founded']}")
    lines.append('  { ' + ', '.join(parts) + ' },')
lines.append('];')
open(os.path.join(ROOT, 'src', 'engine', 'data', 'clubs.ts'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print('wrote', len(seeds), 'clubs;', sum(1 for s in seeds if s.get('logo')), 'with badges')
