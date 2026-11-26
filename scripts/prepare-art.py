"""Prepare delivered art sheets for the game (run: python3 scripts/prepare-art.py <src_dir>).

Expects files named after the sheets (bodies.png, bodies-map.png, faces.png, ...). It:
- resizes every sheet to exactly 2048 x 1024 so the grid cells are exact;
- for sheets painted directly in the key colours (red = club main, green = club second,
  blue = skin) and delivered without a -map file, splits them into a shaded grey base plus a map;
- turns the icon sheet into a luminance mask (white = shown, black details = cut out);
- saves opaque sheets (venues, banners) as JPEG, the rest as WebP (maps stay exact PNG) into public/art/.
"""
import os, sys
from PIL import Image

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'art')
os.makedirs(OUT, exist_ok=True)
SIZE = (2048, 1024)
OPAQUE = {'venues-outside', 'venues-inside', 'banners'}

def classify(r, g, b):
    # by hue dominance, so shadows and highlights of a key colour are recognised too
    if r > 45 and (r - max(g, b)) > 0.6 * r: return 'r'
    if g > 40 and (g - max(r, b)) > 0.35 * g: return 'g'
    if b > 45 and (b - max(r, g)) > 0.28 * b: return 'b'
    return None

def split_self_mapped(im, keys='rgb'):
    im = im.convert('RGBA')
    base = im.copy(); mp = Image.new('RGBA', im.size, (0, 0, 0, 0))
    bp, mpx, px = base.load(), mp.load(), im.load()
    key = {'r': (255, 0, 0), 'g': (0, 255, 0), 'b': (0, 0, 255)}
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            if a < 20: continue
            k = classify(r, g, b)
            if not k or k not in keys: continue
            v = {'r': r, 'g': g, 'b': b}[k]
            shade = min(255, int(v * 1.05))
            bp[x, y] = (shade, shade, shade, a)
            mpx[x, y] = (*key[k], a)
    return base, mp

def icon_mask(im):
    im = im.convert('RGBA'); px = im.load()
    out = Image.new('RGBA', im.size, (255, 255, 255, 0)); op = out.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            lum = (r * 299 + g * 587 + b * 114) // 1000
            op[x, y] = (255, 255, 255, a * lum // 255)
    return out

for name in ['bodies', 'faces', 'venues-outside', 'venues-inside', 'shop', 'icons', 'banners', 'facilities', 'emblems']:
    src = os.path.join(SRC, f'{name}.png')
    if not os.path.exists(src):
        print('missing', name); continue
    im = Image.open(src).resize(SIZE, Image.LANCZOS)
    if name in OPAQUE:
        im.convert('RGB').save(os.path.join(OUT, f'{name}.jpg'), quality=84, optimize=True, progressive=True)
        print('saved', name, 'jpg'); continue
    if name == 'icons':
        icon_mask(im).save(os.path.join(OUT, 'icons.webp'), quality=90, method=4); print('saved icons'); continue
    msrc = os.path.join(SRC, f'{name}-map.png')
    if os.path.exists(msrc):
        mp = Image.open(msrc).convert('RGBA').resize(SIZE, Image.NEAREST)
        base = im.convert('RGBA')
    elif name in ('faces', 'shop', 'emblems'):
        base, mp = split_self_mapped(im, 'rgb' if name == 'faces' else 'rg')
    else:
        base, mp = im.convert('RGBA'), None
    base.save(os.path.join(OUT, f'{name}.webp'), quality=86, method=4)
    if mp: mp.save(os.path.join(OUT, f'{name}-map.png'), optimize=True)
    print('saved', name, '+map' if mp else '')
