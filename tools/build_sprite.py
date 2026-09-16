"""Pack the sample tile art into one sprite sheet for the web app.

The source crops live outside this repo (surima/assets/sample-tiles/cropped).
They are 176x223 RGBA with a transparent background and a soft drop shadow.
We trim each to a common box, scale to a sensible display height and lay them
out in a single row so the UI can address a tile by x-offset alone.

Output: public/tiles.png + the geometry constants the CSS needs.
"""

import sys
from pathlib import Path

from PIL import Image

SRC = Path(
    sys.argv[1]
    if len(sys.argv) > 1
    else "D:/MEGA/Projects/surima/assets/sample-tiles/cropped"
)
OUT = Path("public/tiles.png")

# mjai tile name -> source filename, in canonical ALL_TILES order.
# Note: haku (白) is the blank-faced tile, so mjai 'P' maps to honor_blank.
ORDER: list[tuple[str, str]] = []
for suit, prefix in (("m", "man"), ("p", "pin"), ("s", "sou")):
    for n in range(1, 10):
        ORDER.append((f"{n}{suit}", f"{prefix}_{n}.png"))
for name, fn in (
    ("E", "honor_E.png"),
    ("S", "honor_S.png"),
    ("W", "honor_W.png"),
    ("N", "honor_N.png"),
    ("P", "honor_blank.png"),
    ("F", "honor_F.png"),
    ("C", "honor_C.png"),
):
    ORDER.append((name, fn))
# Red fives are appended after the 34 base tiles.
for name, fn in (
    ("5mr", "man_5_red.png"),
    ("5pr", "pin_5_red.png"),
    ("5sr", "sou_5_red.png"),
):
    ORDER.append((name, fn))

TILE_H = 128  # rendered cell height in the sheet


def load(fn: str) -> Image.Image:
    im = Image.open(SRC / fn).convert("RGBA")
    # Trim to the non-transparent content so every tile shares one baseline.
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def main():
    tiles = [(name, load(fn)) for name, fn in ORDER]

    # Normalise to a single cell size using the widest aspect ratio, so no tile
    # is distorted or clipped.
    max_ratio = max(im.width / im.height for _, im in tiles)
    cell_h = TILE_H
    cell_w = round(cell_h * max_ratio)

    sheet = Image.new("RGBA", (cell_w * len(tiles), cell_h), (0, 0, 0, 0))
    for i, (_, im) in enumerate(tiles):
        h = cell_h
        w = round(im.width * (h / im.height))
        im = im.resize((w, h), Image.LANCZOS)
        sheet.paste(im, (i * cell_w + (cell_w - w) // 2, 0), im)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # The art uses few distinct colours, so a 64-colour palette is visually
    # lossless here and cuts the sheet from ~316 KB to ~52 KB.
    sheet.quantize(colors=64, method=Image.FASTOCTREE).save(OUT, optimize=True)

    kb = OUT.stat().st_size / 1024
    print(f"{len(tiles)} tiles -> {OUT} ({sheet.width}x{sheet.height}, {kb:.0f} KB)")
    print(f"cell: {cell_w}x{cell_h}")
    print("index order:", " ".join(n for n, _ in tiles))


if __name__ == "__main__":
    main()
