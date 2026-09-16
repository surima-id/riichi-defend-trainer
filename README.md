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
| Small and knocked back | Called away by another player. |

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

Called melds show **which seat fed the call**, the way a real table does: the
called tile is laid sideways, leftmost when taken from kamicha (your left),
middle from toimen, rightmost from shimocha. It is the only visual record of
who dealt into a call, so it is worth reading. (The data validates itself —
every chi in the corpus comes from kamicha, which is the only seat you may
chi from.)

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

## Scoring

Binary right/wrong would grade a three-sided wait the same as a tanki, so guesses
are scored on set overlap: F1 between the selected and true wait sets, scaled to
80 points, with 100 for an exact match. Red fives normalise — guessing `5m`
covers `5mr`.

## Running

```bash
npm install
npm run dev      # dev server
npm test         # 28 unit tests
npm run build    # typecheck + production build
```

## Data licensing

Tenhou publishes terms governing use of its 牌譜, including restrictions on
redistribution. This repo ships only **derived puzzle positions** (a river, some
melds and an answer) rather than republishing logs, and the raw shard stays out
of version control. Review Tenhou's terms before deploying publicly.

Mahjong Soul and Riichi City have no comparable public corpus — MJS records are
only obtainable by scraping the WebSocket API, which is slow and ToS-murky.
