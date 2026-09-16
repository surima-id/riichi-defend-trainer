"""Replay Tenhou/mjai logs and extract "guess the wait" puzzle positions.

For every riichi declaration (and, optionally, tenpai open hands) we snapshot
the table as an observer sees it: the target's river with tedashi/tsumogiri
marks and their called melds, but never their concealed hand. The answer is
computed from the hand the log actually records, so it is ground truth even
when the hand never wins and is never revealed.
"""

import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pyarrow.parquet as pq

from mjtiles import normalize, sort_key
from waits import waits_for
from yaku import has_yaku

WINDS = ["E", "S", "W", "N"]


class Player:
    def __init__(self, tehai):
        self.hand = list(tehai)          # concealed tiles
        self.river = []                  # {pai, tsumogiri, riichi, called}
        self.melds = []                  # {type, tiles, from, taken}
        self.riichi = False
        self.riichi_turn = None
        self.drawn = None
        # One entry per discard: what they drew, what they cut, and the
        # concealed hand left behind. Recorded for every player during the
        # replay because we do not yet know who the puzzle will target.
        self.history = []

    def n_called_melds(self):
        return len(self.melds)


def _remove_one(hand, pai):
    """Remove one tile, preferring the exact string so aka bookkeeping holds."""
    if pai in hand:
        hand.remove(pai)
        return
    norm = normalize(pai)
    for h in hand:
        if normalize(h) == norm:
            hand.remove(h)
            return


def replay(events, want_open, rng, keep_prob):
    """Yield puzzle dicts from one game's event list."""
    players = None
    meta = {}
    pending_riichi = set()
    emitted_open = set()

    for e in events:
        t = e["type"]

        if t == "start_kyoku":
            players = [Player(h) for h in e["tehais"]]
            meta = {
                "bakaze": e["bakaze"],
                "kyoku": e["kyoku"],
                "honba": e["honba"],
                "oya": e["oya"],
                "dora_markers": [e["dora_marker"]],
                "scores": e["scores"],
            }
            pending_riichi = set()
            emitted_open = set()
            continue

        if players is None:
            continue

        if t == "tsumo":
            players[e["actor"]].drawn = e["pai"]

        elif t == "dora":
            meta["dora_markers"].append(e["dora_marker"])

        elif t == "reach":
            pending_riichi.add(e["actor"])

        elif t == "dahai":
            a = e["actor"]
            p = players[a]
            declaring = a in pending_riichi

            drew = p.drawn
            if p.drawn is not None:
                p.hand.append(p.drawn)
                p.drawn = None
            _remove_one(p.hand, e["pai"])
            p.history.append({
                "draw": drew,
                "discard": e["pai"],
                "tsumogiri": bool(e.get("tsumogiri", False)),
                "hand": list(p.hand),
                "melds": p.n_called_melds(),
            })
            p.river.append({
                "pai": e["pai"],
                "tsumogiri": bool(e.get("tsumogiri", False)),
                "riichi": declaring,
                "called": False,
            })
            if declaring:
                p.riichi = True
                p.riichi_turn = len(p.river)
                pending_riichi.discard(a)

            # Snapshot AFTER the discard: hand is back to 13 - 3*melds tiles
            # and the river the observer sees includes the tile just cut.
            n = p.n_called_melds()
            if len(p.hand) != 13 - 3 * n:
                continue
            eligible = declaring or (want_open and n > 0 and a not in emitted_open)
            if not eligible:
                continue
            w = waits_for(p.hand, n)
            if not w:
                continue
            if not declaring and rng.random() > keep_prob:
                continue
            if not declaring:
                emitted_open.add(a)
            yield _make_puzzle(players, a, meta, w, _ron_waits(p, w, meta, a), declaring)

        elif t in ("pon", "chi", "daiminkan"):
            a, tgt = e["actor"], e["target"]
            p = players[a]
            p.drawn = None
            for h in e["consumed"]:
                _remove_one(p.hand, h)
            p.melds.append({
                "type": t,
                "tiles": sorted(list(e["consumed"]) + [e["pai"]], key=sort_key),
                "from": tgt,
                "taken": e["pai"],
            })
            if players[tgt].river:
                players[tgt].river[-1]["called"] = True

        elif t == "ankan":
            a = e["actor"]
            p = players[a]
            if p.drawn is not None:
                p.hand.append(p.drawn)
                p.drawn = None
            for h in e["consumed"]:
                _remove_one(p.hand, h)
            p.melds.append({
                "type": "ankan",
                "tiles": sorted(list(e["consumed"]), key=sort_key),
                "from": a,
                "taken": None,
            })

        elif t == "kakan":
            a = e["actor"]
            p = players[a]
            if p.drawn is not None:
                p.hand.append(p.drawn)
                p.drawn = None
            _remove_one(p.hand, e["pai"])
            for m in p.melds:
                if m["type"] == "pon" and normalize(m["taken"]) == normalize(e["pai"]):
                    m["type"] = "kakan"
                    m["tiles"] = sorted(m["tiles"] + [e["pai"]], key=sort_key)
                    break

        elif t == "end_kyoku":
            players = None


def _ron_waits(p, waits, meta, seat):
    """The subset of `waits` that could actually be ronned.

    A hand with no yaku cannot claim a discard. Players call hands into
    yakuless shapes on purpose -- keishiki tenpai, taken to collect noten
    payments at an exhaustive draw -- and nobody can deal into those, so their
    "waits" are not dangerous tiles however completely they fill the hand.

    Riichi is itself a yaku, so a declared hand's whole wait set stands.
    """
    if p.riichi:
        return list(waits)
    bakaze = meta["bakaze"]
    seat_wind = WINDS[(seat - meta["oya"]) % 4]
    return [
        t for t in waits
        if has_yaku(p.hand + [t], p.melds, bakaze, seat_wind, t)
    ]


def _make_puzzle(players, target, meta, waits, ron_waits, is_riichi):
    p = players[target]
    # The observer sits across from the target; that seat's own concealed hand
    # is information a real player at the table would have, so it is recorded.
    # Every other seat's hand stays hidden, as it would be in a real game.
    viewer = (target + 2) % 4
    others = []
    for i, q in enumerate(players):
        if i == target:
            continue
        o = {
            "seat": i,
            "river": q.river,
            "melds": q.melds,
            "riichi": q.riichi,
        }
        if i == viewer:
            # The snapshot is taken immediately after the target's discard, so
            # this seat has not drawn yet: its concealed hand is the whole of
            # what it can see.
            o["hand"] = sorted(q.hand, key=sort_key)
        others.append(o)
    return {
        "target": {
            "seat": target,
            "river": p.river,
            "melds": p.melds,
            "riichi": p.riichi,
            "riichiTurn": p.riichi_turn,
            "seatWind": WINDS[(target - meta["oya"]) % 4],
        },
        "others": others,
        "round": {
            "bakaze": meta["bakaze"],
            "kyoku": meta["kyoku"],
            "honba": meta["honba"],
            "doraMarkers": list(meta["dora_markers"]),
            "scores": meta["scores"],
            "oya": meta["oya"],
        },
        "answer": sorted(waits, key=sort_key),
        # Waits that can actually be ronned; equal to "answer" unless the hand
        # is keishiki tenpai, in which case it may be empty.
        "ronAnswer": sorted(ron_waits, key=sort_key),
        "kind": "riichi" if is_riichi else "open",
        "turn": len(p.river),
        "history": _history(p),
    }


def _history(p):
    """The target's hand after each of their discards, with the wait at that
    point. Lets the reveal walk through how the hand actually developed --
    including when it first reached tenpai, which is the thing a reader is
    really trying to infer from the river."""
    out = []
    for h in p.history:
        hand = sorted(h["hand"], key=sort_key)
        # Only tenpai hands have waits; anything further out is left empty.
        w = waits_for(hand, h["melds"]) if len(hand) == 13 - 3 * h["melds"] else []
        out.append({
            "draw": h["draw"],
            "discard": h["discard"],
            "tsumogiri": h["tsumogiri"],
            "hand": hand,
            "waits": sorted(w, key=sort_key),
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="data/raw/tenhou-00000.parquet")
    ap.add_argument("--out", default="data/puzzles.jsonl")
    ap.add_argument("--games", type=int, default=4000)
    ap.add_argument("--max", type=int, default=6000)
    ap.add_argument("--open", action="store_true", help="also extract open tenpai hands")
    ap.add_argument("--open-prob", type=float, default=0.25)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    pf = pq.ParquetFile(args.src)
    n_games = n_out = 0
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)

    with open(args.out, "w", encoding="utf-8") as fh:
        for batch in pf.iter_batches(batch_size=200, columns=["game_id", "events"]):
            for row in batch.to_pylist():
                if n_games >= args.games or n_out >= args.max:
                    break
                n_games += 1
                try:
                    events = [json.loads(l) for l in row["events"].strip().split("\n")]
                except json.JSONDecodeError:
                    continue
                for pz in replay(events, args.open, rng, args.open_prob):
                    pz["gameId"] = row["game_id"]
                    fh.write(json.dumps(pz, ensure_ascii=False) + "\n")
                    n_out += 1
                    if n_out >= args.max:
                        break
            if n_games >= args.games or n_out >= args.max:
                break

    print(f"games scanned: {n_games}  puzzles: {n_out} -> {args.out}")


if __name__ == "__main__":
    main()
