"""Compact data/puzzles.jsonl into public/puzzles.json for the web app.

The verbose extraction format costs ~2.7 KB per puzzle, most of it repeated
object keys in the three non-target rivers. We pack each river tile into a
single string token so the shipped file stays small enough to load eagerly:

    "4s"     tsumogiri
    "-4s"    tedashi   (leading '-')
    "*4s"    riichi declaration tile
    "!4s"    called by another player

Seats carry "h" only for the observer, whose own hand they can see.

Flags combine in that order, e.g. "-*4s" is a tedashi riichi declaration.
"""

import json
from pathlib import Path

SRC = Path("data/puzzles.jsonl")
OUT = Path("public/puzzles.json")


def pack_river(river):
    out = []
    for t in river:
        prefix = ""
        if not t["tsumogiri"]:
            prefix += "-"
        if t["riichi"]:
            prefix += "*"
        if t["called"]:
            prefix += "!"
        out.append(prefix + t["pai"])
    return out


def pack_melds(melds, owner):
    """[type, from-offset, taken-index, tiles...].

    The called tile is drawn sideways, and *which* tile in the set is rotated
    is how a real table shows who the call was taken from: leftmost for the
    player to your left (kamicha), rightmost for the one to your right
    (shimocha). So we keep both the relative seat the tile came from and which
    tile in the sorted set it was.
    """
    out = []
    for m in melds:
        taken = m.get("taken")
        # Relative offset from the meld's owner: 1 shimocha, 2 toimen, 3 kamicha.
        rel = 0 if m["from"] is None else (m["from"] - owner) % 4
        idx = -1
        if taken is not None:
            try:
                idx = m["tiles"].index(taken)
            except ValueError:
                idx = -1
        out.append([m["type"][0], rel, idx, *m["tiles"]])
    return out


def pack_history(hist):
    """Pack the turn-by-turn hand development.

    Consecutive hands usually differ by at most one tile (the draw in, the
    discard out), so we store the first hand in full and thereafter only the
    delta. The client replays it. Waits are stored only when they change,
    since a hand usually holds its wait once tenpai.

    A call is the exception: pon/chi/kan move several tiles out of the
    concealed hand and add nothing back, so a step can remove tiles without
    gaining any. Both sides of the delta must be emitted independently or that
    step replays as "nothing changed" and the hand never shrinks.
    """
    out = []
    prev_waits = None
    for i, h in enumerate(hist):
        e = {"d": h["discard"]}
        if h["tsumogiri"]:
            e["g"] = 1
        if h["draw"]:
            e["t"] = h["draw"]
        if i == 0:
            e["h"] = h["hand"]          # full starting snapshot
        else:
            # The hand after this discard, expressed as what moved.
            gained = _diff(hist[i - 1]["hand"], h["hand"])
            lost = _diff(h["hand"], hist[i - 1]["hand"])
            if gained:
                e["i"] = gained         # tile(s) added
            if lost:
                e["o"] = lost           # tile(s) removed
        w = h["waits"]
        if w != prev_waits:
            e["w"] = w
            prev_waits = w
        out.append(e)
    return out


def _diff(a, b):
    """Multiset b - a, as a list."""
    rem = list(a)
    out = []
    for x in b:
        if x in rem:
            rem.remove(x)
        else:
            out.append(x)
    return out


def pack_seat(s):
    d = {"s": s["seat"], "r": pack_river(s["river"])}
    if s["melds"]:
        d["m"] = pack_melds(s["melds"], s["seat"])
    if s["riichi"]:
        d["q"] = 1
    # Only the observer's seat carries a concealed hand; every other seat's is
    # hidden, so the key is absent rather than empty.
    if s.get("hand"):
        d["h"] = s["hand"]
    return d


def main():
    rows = [json.loads(l) for l in SRC.open(encoding="utf-8")]
    packed = []
    for p in rows:
        t = p["target"]
        packed.append({
            "t": pack_seat(t),
            "o": [pack_seat(o) for o in p["others"]],
            "b": p["round"]["bakaze"],
            "k": p["round"]["kyoku"],
            "h": p["round"]["honba"],
            "d": p["round"]["doraMarkers"],
            "y": p["round"]["oya"],
            "c": p["round"]["scores"],
            "a": p["answer"],
            # Only emitted when it differs from "a" -- i.e. keishiki tenpai,
            # where some or all of the wait cannot be ronned for lack of a yaku.
            **({"x": p["ronAnswer"]} if p.get("ronAnswer") != p["answer"] else {}),
            "n": 1 if p["kind"] == "riichi" else 0,
            "u": p["turn"],
            "z": pack_history(p["history"]),
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(packed, separators=(",", ":"), ensure_ascii=False), encoding="utf-8"
    )
    kb = OUT.stat().st_size / 1024
    print(f"{len(packed)} puzzles -> {OUT} ({kb:.0f} KB, {kb * 1024 / len(packed):.0f} B each)")


if __name__ == "__main__":
    main()
