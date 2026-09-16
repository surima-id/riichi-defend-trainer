# Surima Riichi Defend Trainer

Rapid-fire wait-reading drill built on real Tenhou Houou (鳳凰卓) game logs.

You are shown an opponent's discard pond — with tedashi and tsumogiri
distinguished — plus their melds, the dora and the round context. You pick every
tile you believe completes their hand. The app grades the guess and moves on.

## The reading cue

This is the whole point of the drill, so the river renders it literally:

| Rendering | Meaning |
| --- | --- |
| **Bright, full colour** | **Tsumogiri** — cut straight from the draw. The hand did not change. |
| **Greyed** | **Tedashi** — came out of the hand. The shape changed; this is information. |
| Turned sideways, wider slot | The riichi declaration tile. |
| Sideways tile inside a meld | The called tile — its position shows which seat it came from. |
| 🖐 in the corner | Called away by another player. Nothing else about the tile changes, so a called tedashi looks exactly like any other tedashi — being claimed and being cut from the draw are different facts, and dimming or shrinking the tile conflated them. |

## The table

The four ponds are laid out around a centre info box the way an online client
draws the table, and **each pond is rotated to face its own player** — so fill
order and the sideways riichi tile read correctly from that seat, exactly as
they would in game. The seat you are reading always sits at the bottom (the
"self" position), with the other three in real relative seating: shimocha
right, toimen top, kamicha left. Each seat's called melds sit beside its pond
and rotate with it. Only the nameplates stay upright, since upside-down text
is simply hard to read.

Ponds are absolutely positioned rather than laid out in a grid: a CSS rotation
does not affect layout, so a rotated block in normal flow would still reserve
its unrotated footprint and the table would come out lopsided. The pond stays
centred in its seat area whether or not that seat has melds, which is what
keeps all four aligned around the centre box.

Called melds lay the called tile sideways, the way a real table does. Which
tile gets rotated depends on the call, because the sideways tile carries two
different facts:

- A **chi** is three *different* tiles, so it rotates the tile that was
  actually claimed — a 3s4s5s taken on the 4s rotates the middle tile.
  Rotating by seat position instead would name a tile that was never called.
  Nothing is lost, since a chi may only be taken from kamicha.
- A **pon or kan** is identical tiles, so no choice can misname the called
  tile. Position is then the only record of who fed the call, so the seat's
  conventional slot is used: leftmost for kamicha (your left), middle for
  toimen, rightmost for shimocha.

(The data validates itself — every chi in the corpus comes from kamicha, which
is the only seat you may chi from.)

Tedashi is drawn as a greyscale filter rather than transparency: against the
dark mat a transparent tile reads as *harder* to see than an opaque one, which
would invert the very cue the drill is teaching.

## Theme

Dark-only, using the same felt-green and gold tokens as the Surima trainer
(train.surima.id): `--color-felt-*` for surfaces, `--color-gold-*` for accents,
Inter for type. `dark` is declared as an unconditional Tailwind variant, so
there is no toggle and no media query to keep in sync. Tiles are sized close to
Tenhou's own scale so the table reads at a glance rather than squinting.

## After you answer

The reveal includes a turn-by-turn replay of how the hand actually developed:
the hand after each discard, what was drawn and cut, the wait at that point,
and the turn the hand first reached tenpai. The river tells you *that* the hand
changed; this shows *how*, which is what turns a wrong guess into a lesson.

This is possible because the log records everything — the replay is
reconstructed, not inferred. Packed as deltas (first hand in full, then the
tile that entered each turn), it costs ~800 B per puzzle instead of ~2 KB.

Tile art is packed into a single sprite sheet by `tools/build_sprite.py` from
`surima/assets/sample-tiles/cropped`. A 64-colour palette is visually lossless
on this art and takes the sheet from ~316 KB to ~52 KB. Note that haku (白) is
the blank-faced tile, so a haku pon correctly renders as three blank tiles.

## Where the answers come from

Every position is a real hand from the
[hhim8826/tenhou-houou-mjai](https://huggingface.co/datasets/hhim8826/tenhou-houou-mjai)
dataset (1.62M four-player Houou games in mjai format).

The waits are **ground truth, not inference**. `start_kyoku` records all four
starting hands and every draw, call and discard is logged, so the extractor
replays each hand and knows the target's exact 13 tiles at the snapshot moment.
That means a position is usable even when the hand never wins and is never
revealed — which is most of them.

`dahai` events carry an explicit `tsumogiri` boolean, so the tedashi/tsumogiri
flag is read from the log rather than reconstructed by comparing tile IDs. (Tile
comparison disagrees on ~0.4% of discards, all cases where a player drew a tile
and hand-cut an identical copy; the flag is correct there and the comparison is
not.)

## Layout

```
tools/
  mjtiles.py         tile notation helpers
  waits.py           win detection + wait enumeration (standard/chiitoi/kokushi)
  yaku.py            does a complete hand hold a yaku? (keishiki tenpai check)
  extract.py         replays mjai logs -> data/puzzles.jsonl
  build_sprite.py    packs tile art -> public/tiles.png
  validate.py        cross-checks the solver against real game outcomes
  build_web_data.py  packs jsonl -> public/puzzles.json
src/
  lib/               tiles, scoring, wire-format unpacking
  components/        Tile, Pond, Table, TileSelector, HandReplay
  App.tsx            quiz flow
```

## Regenerating the puzzle set

```bash
# 1. Fetch one shard (~300 MB) of the dataset
curl -L -o data/raw/tenhou-00000.parquet \
  https://huggingface.co/datasets/hhim8826/tenhou-houou-mjai/resolve/main/data/tenhou-00000.parquet

# 2. Extract positions (riichi declarations + a sample of open tenpai hands)
python tools/extract.py --games 9000 --max 2600 --open --open-prob 0.16

# 3. Pack for the browser
python tools/build_web_data.py
```

`data/raw/` is gitignored — the shard is not redistributed.

### Sanity-checking the solver

```bash
python tools/validate.py data/raw/tenhou-00000.parquet 800
```

Replays every hand to its `hora` and asserts the actual winning tile appears in
the computed wait set. Current result: **7168 / 7171 (99.96%)**. The three
misses are artifacts of the validator's own win-tile inference on chankan and
multi-ron, not solver errors.

The same pass validates the yaku test in the direction that matters. Every ron
the server allowed must have held a yaku, so a ron our detector calls yakuless
is a false negative — and false negatives are the dangerous direction, since
they would mark a genuinely deadly tile safe. Over 2000 games: **5635 / 5648
open-hand rons (99.77%)**, and every one of the 13 misses is a houtei, which is
timing rather than shape and is deliberately out of scope.

## Safe-tile reading

The same ground truth read from the other side: you are shown your own hand and
asked which tiles you could cut without dealing in.

Two things make the answer narrower than "everything that is not a wait":

**A yakuless hand cannot ron.** Players call hands into tenpai shapes with no
yaku on purpose — keishiki tenpai, taken purely to collect the noten payments
at an exhaustive draw. Such a hand's waits complete the shape arithmetically,
but nobody can deal into them, so those tiles are not dangerous. `tools/yaku.py`
answers the yes/no question "does this hand hold at least one yaku", and the
extractor ships the ron-able subset of the wait set alongside the full one.
Riichi is itself a yaku, so a declared hand's whole wait set stands. About 13%
of open hands in the corpus have a wait that cannot be ronned, and ~5% cannot
ron at all.

Situational yaku (haitei, houtei, chankan, rinshan) depend on *when* the tile
appears rather than on the hand, so they are not counted. That leaves one real
gap: a houtei ron on the final discard can claim an otherwise yakuless hand.
It is 0.23% of open-hand rons in the corpus, and it is the only case the drill
calls safe when it is not.

**Fully safe hands are kept.** Positions where nothing in hand deals in are
part of the drill rather than filtered out of it. "Everything I hold passes" is
a real read, and excluding those hands would train the opposite reflex — that a
dangerous tile must be in there somewhere, so one must be found. Only hands
with no safe tile at all are dropped, since they have no answer to give.

Scoring is asymmetric, because the mistakes are. Passing over a safe tile costs
a little tempo; naming a wait tile safe deals in. So one deal-in zeroes the
score however many correct tiles were picked alongside it, and the rest is the
share of genuinely safe tiles found.

## Scoring

Binary right/wrong would grade a three-sided wait the same as a tanki, so wait
guesses are scored on set overlap: F1 between the selected and true wait sets,
scaled to 80 points, with 100 for an exact match. Red fives normalise —
guessing `5m` covers `5mr`.

Safe-tile reading is scored differently, because its mistakes are asymmetric.
The score is simply **the share of safe tiles found** — read two thirds of them
and you score 67 — and each tile that deals in subtracts a flat **120**. The
penalty exceeds the 100 a perfect read can earn, so a deal-in can never be
offset by the safe tiles picked alongside it; at the table the hand is simply
over. Scores can go negative, which is the point: guessing widely and hoping
must cost more than passing on the tiles you cannot read.

## Running

```bash
npm install
npm run dev      # dev server
npm test         # 56 unit tests
npm run build    # typecheck + production build
```

## Data licensing

Tenhou publishes terms governing use of its 牌譜, including restrictions on
redistribution. This repo ships only **derived puzzle positions** (a river, some
melds and an answer) rather than republishing logs, and the raw shard stays out
of version control. Review Tenhou's terms before deploying publicly.

Mahjong Soul and Riichi City have no comparable public corpus — MJS records are
only obtainable by scraping the WebSocket API, which is slow and ToS-murky.
