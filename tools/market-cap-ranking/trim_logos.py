"""logos/ の余白を削り、横長ワードマークの一部はシンボルマークだけに切り出す。
usage: python3 trim_logos.py   (fetch.js の後に実行。要 Pillow)
"""
import os
from PIL import Image, ImageChops

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logos")
# 左端のシンボルだけ使う銘柄（ワードマークだと小さすぎて潰れるもの）
SYMBOL_ONLY = {"8306", "7203", "7182", "9432", "4519"}
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


for f in sorted(os.listdir(DIR)):
    p = os.path.join(DIR, f)
    if f.split(".")[0] in USE_VECTOR:
        os.remove(p)
        continue
    im = trim(Image.open(p).convert("RGBA"))
    if f.split(".")[0] in SYMBOL_ONLY:
        im = left_symbol(im)
    im.save(os.path.splitext(p)[0] + ".png")
    print(f, im.size)
