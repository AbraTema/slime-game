"""Concept sheets v2 (chunkier pixels): knight, slimes, king slime, level mockups.
Game base resolution 256x144 (x5 -> 1280x720). Run: python3 tools/concepts.py -> docs/concepts/*.png
"""
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "concepts")
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith(".png"):
        os.remove(os.path.join(OUT, f))
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
INK = "#1a1420"


def C(h, a=255):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def outline(img, col=INK):
    a = np.array(img)
    alpha = a[..., 3] > 0
    p = np.pad(alpha, 1)
    nb = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    a[nb & ~alpha] = C(col)
    return Image.fromarray(a)


def from_grid(rows, pal, ol=INK):
    w, h = max(len(r) for r in rows), len(rows)
    im = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != ".":
                px[x + 1, y + 1] = C(pal[ch])
    return outline(im, ol)


def up(img, s):
    return img.resize((img.width * s, img.height * s), Image.NEAREST)


# ---------------------------------------------------------------- knight (13 px tall)
KNIGHT_IDLE = [
    "..pp.............",
    ".ppp.............",
    "..Lsss...........",
    ".Lsssss..........",
    ".Lssvvv..........",
    ".Lssvwv..........",
    ".Lsssss..........",
    "..dssd...........",
    ".dLsssaa.........",
    "cdLsssoa.........",
    "cdLsssoah........",
    "cgBBBBoghbbbbbb..",
    "c.Lssd..h........",
    "..Ls.sd..........",
    "..Ls.sd..........",
    "..Ls.sd..........",
    "..gg.gg..........",
]
KNIGHT_SWING = [
    "..pp..........b..",
    ".ppp.........b...",
    "..Lsss......b....",
    ".Lsssss....b.....",
    ".Lssvvv...b......",
    ".Lssvwv..h.......",
    ".Lsssss.g........",
    "..dssd.a.........",
    ".dLsssaa.........",
    "cdLsss...........",
    "cdLsss...........",
    "cgBBBB...........",
    "c.Lssd...........",
    "..Ls.sd..........",
    "..Ls.sd..........",
    "..Ls.sd..........",
    "..gg.gg..........",
]
KNIGHTS = {
    "A": ("A — Классический", dict(p="#e2463f", L="#f2f5f8", s="#c3ccd8", d="#7d8899", v="#232032", w="#ffffff",
                                   c="#3d6fd6", h="#f2c14e", b="#eef3f8", B="#7a4a2a", g="#55607a", a="#aab4c4", o="#3a3446")),
    "B": ("B — Золотой", dict(p="#f4f1ea", L="#ffe49a", s="#e8b64c", d="#a8702a", v="#2a1c1c", w="#ffffff",
                              c="#3f9e5a", h="#c94f3a", b="#eef3f8", B="#6b3a22", g="#7a4e22", a="#d9a548", o="#4a2e18")),
    "C": ("C — Юный с гребнем", dict(p="#ffcc33", L="#e9f1fa", s="#b8c7d9", d="#6f7f96", v="#1f2433", w="#ffffff",
                                     c="#f07b2e", h="#ffcc33", b="#eef3f8", B="#5a3a2a", g="#4e5a70", a="#a3b2c6", o="#343a4a")),
}


def knight(key="A", pose="idle"):
    return from_grid(KNIGHT_IDLE if pose == "idle" else KNIGHT_SWING, KNIGHTS[key][1])


# ---------------------------------------------------------------- slimes (10x7)
SLIME_A = [
    "...xxxx...",
    "..xLxxxx..",
    ".xLxxxxxx.",
    ".xxexxexx.",
    "xxxexxexxx",
    "xxxxmmxxxx",
    "DDDDDDDDDD",
]
SLIME_B = [
    "....x.....",
    "...xxxx...",
    "..xLxxxx..",
    ".xLxxxxxx.",
    ".xxexxexx.",
    "xxxexxexxx",
    "xxxxmmxxxx",
    "DDDDDDDDDD",
]
MINI = [
    "..xx..",
    ".xLxx.",
    "xexxex",
    "DDDDDD",
]
SLIMES = {
    "green": dict(x="#7ee03a", L="#d6ff9e", D="#3f9a1f", e="#1b1022", m="#1b1022", r="#ff9fb8", ol="#1d3d10"),
    "pink": dict(x="#ff7ac1", L="#ffd1ea", D="#c9407f", e="#1b1022", m="#1b1022", r="#ffd1ea", ol="#4a1530"),
    "purple": dict(x="#a66bff", L="#e0ccff", D="#6a35c4", e="#1b1022", m="#1b1022", r="#ff9fb8", ol="#2a1450"),
}


def slime(color, style="A"):
    pal = SLIMES[color]
    grid = {"A": SLIME_A, "B": SLIME_B, "mini": MINI}[style]
    return from_grid(grid, pal, pal["ol"])


def king(kind="gold"):
    W, H = 22, 14
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([0, 4, W - 1, H * 2 + 2], fill=C("#ffffff"))
    a = np.array(im)
    a[H:, :, 3] = 0
    bands = ["#ffd84a", "#ffc23a", "#f5a524", "#d9801a"] if kind == "gold" else \
        ["#ff7ac1", "#a66bff", "#5fd0ff", "#7ee03a"]
    for y in range(H):
        m = a[y, :, 3] > 0
        a[y][m] = C(bands[min(len(bands) - 1, max(0, (y - 4)) * len(bands) // (H - 4))])
    im = Image.fromarray(a)
    d = ImageDraw.Draw(im)
    d.rectangle([3, 7, 4, 8], fill=C("#fff6d6"))
    # crown
    d.polygon([(7, 4), (7, 0), (9, 2), (11, 0), (13, 2), (15, 0), (15, 4)], fill=C("#ffe066"))
    d.point((11, 2), fill=C("#e2463f"))
    # face
    for ex in (7, 13):
        d.rectangle([ex, 7, ex + 1, 9], fill=C("#1b1022"))
        d.point((ex, 7), fill=C("#ffffff"))
    d.point((6, 6), fill=C("#1b1022"))
    d.point((15, 6), fill=C("#1b1022"))
    d.line([(9, 11), (12, 11)], fill=C("#1b1022"))
    big = Image.new("RGBA", (W + 2, H + 2), (0, 0, 0, 0))
    big.paste(im, (1, 1))
    return outline(big, "#3a2010" if kind == "gold" else "#2a1450")


# ---------------------------------------------------------------- props
CRYSTAL = [".x.", "xLx", "xxx", ".x."]
HEART = [".rr.rr.", "rwrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."]
TORCH = [".o.", "oyo", "oyo", ".o.", "mmm", ".t.", ".t.", ".t."]
FLAG = ["pff..", "pfff.", "pffff", "pff..", "p....", "p....", "p....", "p....", "p....", "kk..."]
MUSH = [".ccc....", "ccwcc...", "ccccc.cc", "..s..cwc", "..s...s.", "..s...s."]


def crystal(color):
    pal = SLIMES[color]
    return from_grid(CRYSTAL, dict(x=pal["x"], L=pal["L"]), pal["ol"])


def heart(full=True):
    return from_grid(HEART, dict(r="#ff4d5e" if full else "#5a3a44", w="#ffd0d6" if full else "#5a3a44"))


def torch():
    return from_grid(TORCH, dict(o="#ff8a1e", y="#ffe27a", m="#8a8f99", t="#6b4a2a"))


def flag(color):
    return from_grid(FLAG, dict(p="#c9a46a", f=color, k="#7a5a3a"))


def mush(cap, spot):
    return from_grid(MUSH, dict(c=cap, w=spot, s="#efe2c8"))


# ---------------------------------------------------------------- level mockup (256x144)
DIG = {"0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "x": "000101010101000"}


def tiny_text(img, s, x, y, col):
    px = img.load()
    for ch in s:
        for i, b in enumerate(DIG[ch]):
            if b == "1":
                px[x + i % 3, y + i // 3] = C(col)
        x += 4


SCENES = {
    "1": dict(name="Вариант 1 — «Янтарь»: тёплый коричневый камень",
              wall="#3a2a22", brick="#4e3a2d", mortar="#2a1d17", stone="#6a5243", stone_l="#8a6e58",
              stone_d="#47362c", moss="#7fb83a", moss_l="#b6e05a", moss_d="#4f7d24", leaf="#9ad84a",
              arch="#24180f", ambient=0.5, light="#ffb35c", mush=("#ff9e4a", "#ffe2b8")),
    "2": dict(name="Вариант 2 — «Сиреневый камень»: холодный камень + тёплый свет",
              wall="#2c2834", brick="#3c3646", mortar="#1d1a24", stone="#55505f", stone_l="#7a7488",
              stone_d="#3a3644", moss="#3fae62", moss_l="#7fe08a", moss_d="#25703e", leaf="#8ff07a",
              arch="#16131c", ambient=0.46, light="#ffc46e", mush=("#5fd0ff", "#d8f6ff")),
}


def scene(cfg, kn="A", seed=11):
    rnd = random.Random(seed)
    W, H = 256, 144
    bg = Image.new("RGBA", (W, H), C(cfg["wall"]))
    d = ImageDraw.Draw(bg)

    def vary(hexcol, v):
        r, g, b, _ = C(hexcol)
        k = rnd.randint(-v, v)
        return (max(0, r + k), max(0, g + k), max(0, b + k), 255)

    for row, y in enumerate(range(0, H, 8)):
        off = 0 if row % 2 == 0 else 8
        for x in range(-16 + off, W, 16):
            d.rectangle([x, y, x + 15, y + 7], fill=vary(cfg["brick"], 8))
            d.line([(x, y + 7), (x + 15, y + 7)], fill=C(cfg["mortar"]))
            d.line([(x + 15, y), (x + 15, y + 7)], fill=C(cfg["mortar"]))
    for ax in (30, 168):
        d.rectangle([ax, 56, ax + 40, 112], fill=C(cfg["arch"]))
        d.ellipse([ax, 36, ax + 40, 76], fill=C(cfg["arch"]))
    # ivy patches on the wall
    for _ in range(9):
        x, y = rnd.randrange(W), rnd.randrange(10, 100)
        for _ in range(rnd.randint(6, 14)):
            px_, py_ = x + rnd.randint(-5, 5), y + rnd.randint(-3, 3)
            d.rectangle([px_, py_, px_ + 1, py_], fill=C(rnd.choice([cfg["moss_d"], cfg["moss"]])))

    solids = []

    def block(x, y, w, h):
        solids.append((x, y, w))
        for tx in range(x, x + w, 16):
            for ty in range(y, y + h, 16):
                d.rectangle([tx, ty, tx + 15, ty + 15], fill=vary(cfg["stone"], 5))
                d.line([(tx, ty), (tx + 15, ty)], fill=C(cfg["stone_l"]))
                d.line([(tx, ty), (tx, ty + 15)], fill=C(cfg["stone_l"]))
                d.line([(tx + 15, ty), (tx + 15, ty + 15)], fill=C(cfg["stone_d"]))
                d.line([(tx, ty + 15), (tx + 15, ty + 15)], fill=C(cfg["stone_d"]))
                if rnd.random() < 0.35:
                    cx, cy = tx + rnd.randint(3, 11), ty + rnd.randint(4, 11)
                    d.line([(cx, cy), (cx + 2, cy + 1)], fill=C(cfg["stone_d"]))
        for mx in range(x, x + w):
            d.point((mx, y), fill=C(cfg["moss_l"]))
            d.point((mx, y + 1), fill=C(cfg["moss"]))
            if rnd.random() < 0.6:
                d.point((mx, y + 2), fill=C(cfg["moss"]))
            if rnd.random() < 0.2:
                d.point((mx, y - 1), fill=C(cfg["moss_l"]))

    def vine(x, y0, length):
        sway = rnd.choice([-1, 1])
        for i in range(length):
            xx = x + (sway if (i // 4) % 2 else 0)
            d.point((xx, y0 + i), fill=C(cfg["moss_d"]))
            if i % 3 == 1:
                side = 1 if (i // 3) % 2 else -1
                d.point((xx + side, y0 + i), fill=C(cfg["leaf"]))
                d.point((xx + side * 2, y0 + i - 1), fill=C(cfg["moss"]))
        d.point((x, y0 + length), fill=C(cfg["leaf"]))

    block(0, 112, W, 32)
    block(92, 80, 48, 16)
    block(176, 56, 48, 16)
    block(0, 96, 16, 16)

    # LOTS of hanging greenery: ceiling, under platforms, over ledge edges
    x = 2
    while x < W:
        if rnd.random() < 0.8:
            vine(x, 0, rnd.randint(6, 34))
        x += rnd.choice([5, 6, 7])
    for (bx, by, bw) in solids[1:]:
        for vx in range(bx + 1, bx + bw - 1, 3):
            if rnd.random() < 0.75:
                vine(vx, by + 16, rnd.randint(3, 14))
        for ex in (bx - 1, bx + bw):
            if 0 <= ex < W:
                vine(ex, by + 1, rnd.randint(6, 12))
    for cx in range(0, W, 4):
        for k in range(rnd.randint(1, 4)):
            d.point((cx + rnd.randint(0, 3), k), fill=C(cfg["moss"] if k < 2 else cfg["moss_d"]))

    torches = [(18, 48), (148, 40), (240, 44)]
    for tx, ty in torches:
        bg.alpha_composite(torch(), (tx, ty))
    for mx, my in ((4, 105), (236, 105), (208, 49), (120, 73)):
        bg.alpha_composite(mush(*cfg["mush"]), (mx, my))

    # ---- lighting
    arr = np.array(bg).astype(np.float32) / 255.0
    yy, xx = np.mgrid[0:H, 0:W]
    lr, lg, lb, _ = [c / 255 for c in C(cfg["light"])]
    light = np.full((H, W, 3), cfg["ambient"], np.float32)
    srcs = [(tx + 2, ty + 2, 90, 1.25) for tx, ty in torches]
    srcs += [(9, 108, 20, 0.55), (241, 108, 20, 0.55), (213, 52, 18, 0.5), (125, 76, 18, 0.5)]
    for sx, sy, r, inten in srcs:
        dist = np.sqrt((xx - sx) ** 2 + (yy - sy) ** 2)
        f = np.clip(1 - dist / r, 0, 1) ** 1.6 * inten
        light[..., 0] += f * lr
        light[..., 1] += f * lg
        light[..., 2] += f * lb
    light = np.round(light * 10) / 10
    arr[..., :3] = np.clip(arr[..., :3] * light, 0, 1)
    lit = Image.fromarray((arr * 255).astype(np.uint8))
    for tx, ty in torches:
        lit.alpha_composite(torch().crop((0, 0, 5, 6)), (tx, ty))

    # ---- actors
    actors = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    actors.alpha_composite(knight(kn, "swing"), (44, 93))
    actors.alpha_composite(slime("green", "B"), (70, 102))
    actors.alpha_composite(slime("pink", "B"), (110, 70))
    actors.alpha_composite(slime("purple", "B"), (150, 102))
    actors.alpha_composite(slime("purple", "mini"), (164, 106))
    actors.alpha_composite(slime("green", "B"), (196, 46))
    actors.alpha_composite(flag(KNIGHTS[kn][1]["c"]), (228, 99))
    for cx, cy, col in [(128, 68, "pink"), (136, 98, "green"), (186, 42, "purple"), (96, 66, "green")]:
        actors.alpha_composite(crystal(col), (cx, cy))
    a = np.array(actors).astype(np.float32)
    a[..., :3] *= 0.94
    lit.alpha_composite(Image.fromarray(a.astype(np.uint8)))

    dd = ImageDraw.Draw(lit)
    for _ in range(20):
        dd.point((rnd.randrange(W), rnd.randrange(14, 108)), fill=C("#ffd9a0", rnd.randint(90, 200)))

    for i in range(3):
        lit.alpha_composite(heart(i < 2), (4 + i * 9, 4))
    lit.alpha_composite(from_grid(CRYSTAL, dict(x="#ffd84a", L="#fff6c0"), "#3a2010"), (W - 24, 4))
    tiny_text(lit, "x12", W - 18, 6, "#fff3d6")
    return lit


# ---------------------------------------------------------------- sheets
def label(d, xy, text, size=26, fill="#fff3d6"):
    d.text(xy, text, font=ImageFont.truetype(FONT, size), fill=fill)


def sheet_knights():
    S = 16
    sh = Image.new("RGBA", (900, 420), C("#241a17"))
    d = ImageDraw.Draw(sh)
    label(d, (30, 20), "Рыцарь A — с руками (покой / удар)", 30)
    sh.alpha_composite(up(knight("A", "idle"), S), (60, 90))
    sh.alpha_composite(up(knight("A", "swing"), S), (420, 90))
    sh.alpha_composite(up(knight("A"), 3), (800, 350))
    sh.save(os.path.join(OUT, "01_knight.png"))


def sheet_slimes():
    sh = Image.new("RGBA", (1680, 640), C("#241a17"))
    d = ImageDraw.Draw(sh)
    label(d, (30, 20), "Слаймы v3 — с хохолком, без румянца  ·  Король золотой", 32)
    S = 16
    for i, c in enumerate(SLIMES):
        sh.alpha_composite(up(slime(c, "B"), S), (40 + i * 220, 110))
    label(d, (30, 330), "Мини-слайм (фиолетовый делится на двух)", 24)
    sh.alpha_composite(up(slime("purple", "mini"), S), (40, 380))
    sh.alpha_composite(up(slime("purple", "mini"), S), (190, 380))
    label(d, (760, 90), "Король-слайм: золотой", 24)
    sh.alpha_composite(up(king("gold"), 17), (760, 140))
    label(d, (760, 450), "Масштаб в игре", 24)
    row = Image.new("RGBA", (84, 22), (0, 0, 0, 0))
    row.alpha_composite(knight("A"), (0, 3))
    row.alpha_composite(slime("green", "B"), (18, 12))
    row.alpha_composite(slime("pink", "B"), (31, 12))
    row.alpha_composite(slime("purple", "B"), (44, 12))
    row.alpha_composite(king("gold"), (58, 6))
    sh.alpha_composite(up(row, 7), (760, 480))
    sh.save(os.path.join(OUT, "02_slimes_and_king.png"))


def sheet_scenes():
    for k, cfg in [("1", SCENES["1"])]:
        img = up(scene(cfg), 5)
        canvas = Image.new("RGBA", (img.width, img.height + 64), C("#241a17"))
        canvas.alpha_composite(img, (0, 64))
        label(ImageDraw.Draw(canvas), (20, 16), cfg["name"], 28)
        canvas.save(os.path.join(OUT, "03_level_amber.png"))


if __name__ == "__main__":
    sheet_knights()
    sheet_slimes()
    sheet_scenes()
    print("ok", sorted(os.listdir(OUT)))
