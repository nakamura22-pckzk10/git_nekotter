"""logos/ の余白を削り、横長ワードマークの一部はシンボルマークだけに切り出す。
usage: python3 trim_logos.py   (fetch.js の後に実行。要 Pillow)
"""
import os
from PIL import Image, ImageChops

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logos")
# 左端のシンボルだけ使う銘柄（ワードマークだと小さすぎて潰れるもの）
SYMBOL_ONLY = {"8306", "7203", "7182", "9432", "4519"}
# 文字間より広い空白で区切って左側だけ使う（NEC＋スローガン等）
FIRST_WORD = {"6701": 8}
# 下段のタグライン（企業スローガン・正式社名）を落として上段のロゴだけ使う
TOP_PART = {"7267", "6902", "9501", "7201"}
# 画像が粗い/小さいので simple-icons のベクターに任せる（meta.js の si 指定を使う）
USE_VECTOR = {"7011", "6503", "8058"}


def mask(im, top=1.0):
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    flat = Image.alpha_composite(bg, im).convert("RGB")
    m = ImageChops.difference(flat, Image.new("RGB", im.size, "white")).convert("L").point(lambda v: 255 if v > 18 else 0)
    return m.crop((0, 0, im.size[0], int(im.size[1] * top))) if top < 1.0 else m


def trim(im):
    bb = mask(im).getbbox()
    return im.crop(bb) if bb else im


def first_word(im, min_gap):
    m = mask(im)
    px, (w, h) = m.load(), m.size
    cols = [any(px[x, y] for y in range(h)) for x in range(w)]
    x = 0
    while x < w:
        if not cols[x]:
            g = x
            while g < w and not cols[g]:
                g += 1
            if g - x >= min_gap and any(cols[:x]):
                return trim(im.crop((0, 0, x, h)))
            x = g
        else:
            x += 1
    return im


def left_symbol(im):
    w, h = im.size
    for top in (1.0, 0.72):  # 下にタグラインがあるロゴは上部だけで判定
        m = mask(im, top)
        px, mh = m.load(), m.size[1]
        cols = [any(px[x, y] for y in range(mh)) for x in range(w)]
        x = 0
        while x < w and cols[x]:
            x += 1
        gap = 0
        while x + gap < w and not cols[x + gap]:
            gap += 1
        if 0 < x < w * 0.6 and gap >= 3:
            return trim(im.crop((0, 0, x, int(h * top))))
    return im


def top_part(im):
    m = mask(im)
    px, (w, h) = m.load(), m.size
    rows = [any(px[x, y] for x in range(w)) for y in range(h)]
    y = 0
    while y < h and rows[y]:
        y += 1
    return trim(im.crop((0, 0, w, y))) if 0 < y < h else im


for f in sorted(os.listdir(DIR)):
    p = os.path.join(DIR, f)
    if f.split(".")[0] in USE_VECTOR:
        os.remove(p)
        continue
    im = trim(Image.open(p).convert("RGBA"))
    if f.split(".")[0] in SYMBOL_ONLY:
        im = left_symbol(im)
    if f.split(".")[0] in FIRST_WORD:
        im = first_word(im, FIRST_WORD[f.split(".")[0]])
    if f.split(".")[0] in TOP_PART:
        im = top_part(im)
    im.save(os.path.splitext(p)[0] + ".png")
    print(f, im.size)
