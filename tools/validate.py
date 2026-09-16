"""Cross-validate the wait solver against real game outcomes.

At every `hora` we reconstruct the winner's concealed hand as it stood just
before the winning tile arrived, and assert that our solver lists that tile as
a wait. If the replay bookkeeping or the solver were wrong, real wins would
fail to appear in the computed wait set.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pyarrow.parquet as pq

from mjtiles import normalize
from waits import waits_for
from extract import Player, _remove_one

SRC = sys.argv[1] if len(sys.argv) > 1 else "data/raw/tenhou-00000.parquet"
N_GAMES = int(sys.argv[2]) if len(sys.argv) > 2 else 400

pf = pq.ParquetFile(SRC)
checked = passed = 0
failures = []
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
            elif players is None:
                continue
            elif t == "tsumo":
                players[e["actor"]].drawn = e["pai"]
            elif t == "dahai":
                p = players[e["actor"]]
                if p.drawn is not None:
                    p.hand.append(p.drawn)
                    p.drawn = None
                _remove_one(p.hand, e["pai"])
                last_discard = (e["actor"], e["pai"])
            elif t in ("pon", "chi", "daiminkan"):
                p = players[e["actor"]]
                p.drawn = None
                for h in e["consumed"]:
                    _remove_one(p.hand, h)
                p.melds.append({"type": t})
                last_discard = None
            elif t == "ankan":
                p = players[e["actor"]]
                if p.drawn is not None:
                    p.hand.append(p.drawn)
                    p.drawn = None
                for h in e["consumed"]:
                    _remove_one(p.hand, h)
                p.melds.append({"type": "ankan"})
            elif t == "kakan":
                p = players[e["actor"]]
                if p.drawn is not None:
                    p.hand.append(p.drawn)
                    p.drawn = None
                _remove_one(p.hand, e["pai"])
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
