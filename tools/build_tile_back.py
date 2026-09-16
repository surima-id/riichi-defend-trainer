"""Build the face-down tile back from the Surima logo.

The full emblem carries a ring of script around its outer edge, which is
illegible below about 100px and turns to noise at the 34px a pond tile gets.
There is a clean gap in the artwork at r~0.66-0.70 where that ring begins, so
the mark is cropped just inside it: the flower and its enclosing circle
survive at tile scale, the script does not.

The source art is black on transparent, so the alpha channel is the shape and
the colour is applied fresh -- gold, because a face-down tile has to separate
from the dark felt. The original emerald back sat at nearly the mat's own
lightness and the outer tiles of an ankan all but disappeared into it.

    python tools/build_tile_back.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

SRC = Path(r"D:/MEGA/Projects/surima/assets/logo square black.png")
OUT = Path("public/tile-back.png")

# Just inside the gap between the flower and the script ring.
CROP_R = 0.68
# Drawn at 34px and up; 96 keeps it crisp on hidpi without shipping the full art.
SIZE = 96
GOLD = (234, 179, 8)


def main():
    src = Image.open(SRC).convert("RGBA")
    w, h = src.size
    cx, cy = w / 2, h / 2
    r = CROP_R * (w / 2)
    crop = src.crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r)))

    # The crop is square, so its corners still reach past r into the script
    # ring; mask everything outside the inscribed circle.
    mask = Image.new("L", crop.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, crop.size[0] - 1, crop.size[1] - 1), fill=255)
    alpha = Image.composite(crop.getchannel("A"), Image.new("L", crop.size, 0), mask)

    out = Image.new("RGBA", crop.size, GOLD + (0,))
    out.putalpha(alpha)
    out = out.resize((SIZE, SIZE), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT)
    print(f"{OUT} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
