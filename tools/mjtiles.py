"""Tile notation helpers for mjai format.

mjai tiles: "1m".."9m", "1p".."9p", "1s".."9s", "E","S","W","N","P","F","C"
Red fives are "5mr" / "5pr" / "5sr" and are treated as the ordinary 5 for
shape purposes.
"""

HONORS = ["E", "S", "W", "N", "P", "F", "C"]
SUITS = ["m", "p", "s"]

# Canonical ordering used everywhere a wait set is serialised.
ALL_TILES = [f"{n}{s}" for s in SUITS for n in range(1, 10)] + HONORS
TILE_INDEX = {t: i for i, t in enumerate(ALL_TILES)}


def normalize(pai: str) -> str:
    """Strip the red-five marker: '5mr' -> '5m'."""
    if len(pai) == 3 and pai.endswith("r"):
        return pai[:2]
    return pai


def to_counts(tiles):
    """34-slot count vector."""
    counts = [0] * 34
    for t in tiles:
        counts[TILE_INDEX[normalize(t)]] += 1
    return counts


def sort_key(pai: str):
    return (TILE_INDEX[normalize(pai)], len(pai))
