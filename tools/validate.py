"""Cross-validate the wait solver against real game outcomes.

At every `hora` we reconstruct the winner's concealed hand as it stood just
before the winning tile arrived, and assert that our solver lists that tile as
a wait. If the replay bookkeeping or the solver were wrong, real wins would
fail to appear in the computed wait set.

The same pass validates the yaku test the other way round: every *ron* in the
logs was allowed by the server, so it must have held a yaku. A ron our
detector calls yakuless is a false negative, and false negatives are the
dangerous direction -- they would mark a genuinely deadly tile safe.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pyarrow.parquet as pq

from mjtiles import normalize
from waits import waits_for
from yaku import has_yaku
from extract import Player, _remove_one

WINDS = ["E", "S", "W", "N"]

SRC = sys.argv[1] if len(sys.argv) > 1 else "data/raw/tenhou-00000.parquet"
N_GAMES = int(sys.argv[2]) if len(sys.argv) > 2 else 400

pf = pq.ParquetFile(SRC)
checked = passed = 0
ron_checked = ron_passed = 0
open_ron_checked = open_ron_passed = 0
failures = []
yaku_failures = []
games = 0

for batch in pf.iter_batches(batch_size=200, columns=["game_id", "events"]):
    for row in batch.to_pylist():
        if games >= N_GAMES:
            break
        games += 1
        try:
            events = [json.loads(l) for l in row["events"].strip().split("\n")]
        except json.JSONDecodeError:
            continue

        players = None
        last_discard = None  # (actor, pai)

        for e in events:
            t = e["type"]
            if t == "start_kyoku":
                players = [Player(h) for h in e["tehais"]]
                last_discard = None
                pending_reach = set()
                oya, bakaze = e["oya"], e["bakaze"]
            elif players is None:
                continue
            elif t == "reach":
                pending_reach.add(e["actor"])
            elif t == "reach_accepted":
                players[e["actor"]].riichi = True
                pending_reach.discard(e["actor"])
            elif t == "tsumo":
                players[e["actor"]].drawn = e["pai"]
            elif t == "dahai":
                p = players[e["actor"]]
                if p.drawn is not None:
                    p.hand.append(p.drawn)
                    p.drawn = None
                _remove_one(p.hand, e["pai"])
                if e["actor"] in pending_reach:
                    p.riichi = True
                    pending_reach.discard(e["actor"])
                last_discard = (e["actor"], e["pai"])
            elif t in ("pon", "chi", "daiminkan"):
                p = players[e["actor"]]
                p.drawn = None
                for h in e["consumed"]:
                    _remove_one(p.hand, h)
                p.melds.append({
                    "type": t,
                    "tiles": list(e["consumed"]) + [e["pai"]],
                })
                last_discard = None
            elif t == "ankan":
                p = players[e["actor"]]
                if p.drawn is not None:
                    p.hand.append(p.drawn)
                    p.drawn = None
                for h in e["consumed"]:
                    _remove_one(p.hand, h)
                p.melds.append({"type": "ankan", "tiles": list(e["consumed"])})
            elif t == "kakan":
                p = players[e["actor"]]
                if p.drawn is not None:
                    p.hand.append(p.drawn)
                    p.drawn = None
                _remove_one(p.hand, e["pai"])
                for m in p.melds:
                    if m["type"] == "pon" and normalize(m["tiles"][0]) == normalize(e["pai"]):
                        m["type"] = "kakan"
                        m["tiles"] = m["tiles"] + [e["pai"]]
                        break
            elif t == "hora":
                a = e["actor"]
                p = players[a]
                # Winning tile: own draw (tsumo) or the last discard (ron).
                if e["target"] == a:
                    win_tile = p.drawn
                else:
                    win_tile = last_discard[1] if last_discard else None
                p.drawn = None
                if win_tile is None:
                    continue
                n = len(p.melds)
                if len(p.hand) != 13 - 3 * n:
                    continue
                checked += 1
                w = waits_for(p.hand, n)
                # Every ron the server allowed had a yaku, so our detector must
                # agree. Tsumo is skipped: menzen tsumo is a yaku in its own
                # right and says nothing about the ron case we care about.
                if e["target"] != a:
                    ron_checked += 1
                    seat_wind = WINDS[(a - oya) % 4]
                    is_open = any(m["type"] != "ankan" for m in p.melds)
                    if is_open:
                        open_ron_checked += 1
                    if has_yaku(p.hand + [win_tile], p.melds, bakaze, seat_wind,
                                win_tile, p.riichi):
                        ron_passed += 1
                        if is_open:
                            open_ron_passed += 1
                    elif is_open and len(yaku_failures) < 5:
                        yaku_failures.append({
                            "game": row["game_id"], "win_tile": win_tile,
                            "hand": list(p.hand), "melds": list(p.melds),
                        })
                if normalize(win_tile) in w:
                    passed += 1
                elif len(failures) < 5:
                    failures.append({
                        "game": row["game_id"], "win_tile": win_tile,
                        "hand": p.hand, "melds": n, "computed": w,
                    })
                players = None
            elif t == "end_kyoku":
                players = None
    if games >= N_GAMES:
        break

print(f"games: {games}  wins checked: {checked}  winning tile in computed waits: {passed}")
if checked:
    print(f"accuracy: {100.0 * passed / checked:.3f}%")
for f in failures:
    print("FAIL", f)

print()
print(f"rons checked: {ron_checked}  detected as having a yaku: {ron_passed}")
if ron_checked:
    print(f"yaku recall: {100.0 * ron_passed / ron_checked:.3f}%")
# Open hands are the population that actually matters: a concealed hand in the
# puzzle set is always a declared riichi, and riichi is itself a yaku.
print(f"open-hand rons: {open_ron_checked}  detected: {open_ron_passed}")
if open_ron_checked:
    print(f"open-hand yaku recall: {100.0 * open_ron_passed / open_ron_checked:.3f}%")
for f in yaku_failures:
    print("YAKU FAIL", f)
