"""Builds the link-preview pictures (1200x630 JPEG) that WhatsApp and other apps show for a shared link:
public/og.jpg for the shop and public/images/share/<id>.jpg for each seeded abaya (see src/lib/share.ts).
Cream ground, the MAZUN ATELIER wordmark, and the house model wearing the piece (front and back).
Needs Pillow and the Windows fonts Bodoni MT and Segoe UI.  Run:  python scripts/make-share-images.py ."""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
W, H = 1200, 630
GROUND, SURFACE, INK, MAIN, ACCENT = (246, 239, 231), (236, 226, 213), (43, 27, 28), (94, 35, 41), (184, 146, 106)
BODONI = ImageFont.truetype('C:/Windows/Fonts/BOD_R.TTF', 112)
SANS = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 24)

def ground():
    im = Image.new('RGB', (W, H), GROUND)
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse((560, -260, 1500, 760), fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    return Image.composite(Image.new('RGB', (W, H), SURFACE), im, glow)

def spaced(draw, xy, text, font, fill, track):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + track
    return x

def width(draw, text, font, track):
    return sum(draw.textlength(ch, font=font) for ch in text) + track * (len(text) - 1)

def wordmark(im, cx):
    d = ImageDraw.Draw(im)
    w1 = width(d, 'MAZUN', BODONI, 22)
    spaced(d, (cx - w1 / 2, 214), 'MAZUN', BODONI, INK, 22)
    w2 = width(d, 'ATELIER', SANS, 14)
    spaced(d, (cx - w2 / 2, 352), 'ATELIER', SANS, INK, 14)
    d.line((cx - 120, 412, cx - 14, 412), fill=ACCENT, width=2)
    d.line((cx + 14, 412, cx + 120, 412), fill=ACCENT, width=2)
    d.polygon([(cx, 404), (cx + 8, 412), (cx, 420), (cx - 8, 412)], outline=ACCENT, fill=None)

def figure(im, path, cx, h, base):
    fig = Image.open(path).convert('RGBA')
    w = round(fig.width * h / fig.height)
    fig = fig.resize((w, h), Image.LANCZOS)
    shadow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(shadow).ellipse((cx - w * 0.42, base - 10, cx + w * 0.42, base + 12), fill=110)
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    im.paste(Image.new('RGB', (W, H), (120, 92, 80)), (0, 0), shadow)
    im.paste(fig, (round(cx - w / 2), base - h), fig)

def save(im, name):
    im.save(f'{ROOT}/public/images/share/{name}.jpg', quality=84, optimize=True, progressive=True)

ids = ['noor', 'salma', 'layal', 'zayna', 'dana', 'mazun', 'reem', 'hessa']
worn = lambda i, side='front': f'{ROOT}/public/images/worn/{i}-{side}.webp'

shop = ground(); wordmark(shop, 270)
for k, i in enumerate(['salma', 'noor', 'layal', 'zayna']):
    figure(shop, worn(i), 650 + k * 140, 520, 595)
shop.save(f'{ROOT}/public/og.jpg', quality=84, optimize=True, progressive=True)

for i in ids:
    im = ground(); wordmark(im, 300)
    figure(im, worn(i, 'back'), 930, 540, 600)
    figure(im, worn(i), 760, 560, 606)
    save(im, i)
print('done')
