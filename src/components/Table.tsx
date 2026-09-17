import { useEffect, useRef, useState } from 'react'
import {
  Nameplate,
  Pond,
  PondMelds,
  POND_H,
  POND_W,
  ROTATION,
  RiichiStick,
  STICK_H,
  type Orientation,
} from './Pond'
import { Tile } from './Tile'
import { TILE_W, TILE_H } from './Pond'
import { doraFromMarker, normalize } from '../lib/tiles'
import type { Meld, Pai, Puzzle, RiverTile } from '../lib/types'

/**
 * Safe-tile reading turns your own hand into the answer sheet.
 *
 * The question is which of *these* tiles you could cut, so the hand already
 * drawn below the table is the natural place to answer it — a separate grid
 * repeating the same tiles asks you to match one row against the other before
 * you can even start reading.
 *
 * Selection is by tile face, not by copy: `selected` and `answer` hold
 * normalized tiles, and every copy of a face in hand shows the same state,
 * because safety is a property of the face rather than of the particular tile.
 */
export interface HandSelect {
  selected: Pai[]
  onToggle: (pai: Pai) => void
  disabled: boolean
  /** After submitting or revealing, the tiles that were actually safe. */
  answer: Pai[] | null
}

const WINDS = ['E', 'S', 'W', 'N'] as const
const WIND_KANJI: Record<string, string> = { E: '東', S: '南', W: '西', N: '北' }
const KYOKU_KANJI = ['一', '二', '三', '四']

/**
 * Distance from the table centre to the near edge of every pond.
 *
 * The binding constraint is the corners, not the centre box. Each pond is
 * POND_W wide across its own axis, so it reaches POND_W / 2 sideways from its
 * seat's midline — straight into where the neighbouring, 90-degree-rotated
 * pond begins. Any inset below POND_W / 2 overlaps the two ponds' corners,
 * whatever the centre box is doing. Sitting exactly on that bound leaves the
 * ponds touching, so add a small margin.
 */
const INSET = POND_W / 2 + 6

/**
 * Room beside each pond for that seat's called melds.
 *
 * Sets stack downward rather than running side by side, so this only has to
 * clear the widest single set — a kan, at 147px — plus the gap that separates
 * it from the pond, regardless of how many times the seat has called. Sized too small, a set simply runs past the table's edge
 * and is clipped away.
 */
const MELD_STRIP = 190

/**
 * Gutter outside the ponds, holding the upright nameplates and the called-meld
 * strips.
 *
 * Melds hang off the pond's outer edge, so the gutter has to clear a meld set
 * (one tile tall, 42px) as well as a nameplate (32px). Sized to the nameplate
 * alone, every seat's melds were cut off by the table's edge.
 */
const PLATE_GUTTER = 56

/**
 * Width of one called set. Every tile but the called one stands upright; the
 * called tile lies sideways, so it occupies a TILE_H-wide slot. The tiles are
 * laid out with a 1px gap between them.
 */
function meldWidth(m: Meld): number {
  const upright = m.tiles.length - 1
  return upright * TILE_W + TILE_H + upright * MELD_TILE_GAP
}

/** The `gap-px` between tiles within one called set. */
const MELD_TILE_GAP = 1

/**
 * How far this table's called melds reach sideways from their seat's midline.
 *
 * Melds begin just past the pond's edge and run outward. Because sets stack
 * downward rather than side by side, what matters is the widest single set, not
 * the total of them — so a seat with three calls is no wider than one with a
 * single kan. Measured per hand all the same, since a hand with no calls at all
 * needs none of this room. Sized to the ponds alone, a called set is clipped
 * off by the table's edge.
 */
function meldReach(seats: SeatView[]): number {
  let widest = 0
  for (const s of seats) {
    for (const m of s.melds) widest = Math.max(widest, meldWidth(m))
  }
  return widest === 0 ? 0 : POND_W / 2 + MELD_OFFSET + widest
}

/**
 * Gap between the pond and that seat's called sets.
 *
 * Generous on purpose: melds and discards are different kinds of information,
 * and butted up against each other the leftmost meld tile reads as one more
 * tile in the river.
 */
const MELD_OFFSET = 28

/**
 * Everything in the block that does not scale with the table: the box's own
 * padding, the rule above the hand and the gaps and label around it.
 *
 * Subtracted from the height budget before the table is sized, so the budget
 * is spent on the part that can actually shrink.
 */
const BOX_CHROME = 62

/**
 * Smallest the table may be scaled to.
 *
 * Set by what a river stays countable at, not by what still fits. Below this
 * the suit of a 3p versus a 3s is a guess, and a table you cannot read is
 * worth less than one you have to scroll a little to see — fitting the screen
 * was only ever a means to reading the position. A window short enough to hit
 * this floor gets a scrollbar instead.
 */
const MIN_SCALE = 0.68

/**
 * Largest the table may be scaled to.
 *
 * The tile art is a bitmap drawn at its native size, so past roughly half
 * again it starts to look soft rather than big. Sized to stay the right side
 * of that, which is well past what any laptop's height budget allows anyway.
 */
const MAX_SCALE = 1.45

/**
 * Width of one tile in your own hand, before the table's scale is applied.
 *
 * Larger than a river tile: the hand is the one row you read tile by tile
 * rather than take in as a block, and in safe mode it is also what you click.
 */
const HAND_TILE_W = 46

interface SeatView {
  seat: number
  river: RiverTile[]
  melds: Meld[]
  riichi: boolean
  isTarget: boolean
  hand?: Pai[]
}

/**
 * The four ponds laid out around a centre info box, the way an online client
 * draws the table.
 *
 * You are seated as an observer, never as the player being read. The bottom
 * ("self") seat is the one across from the target, so the target sits at
 * toimen — the seat you would most naturally be reading. Putting the target at
 * the bottom would claim their seat as yours, and at a real table that seat
 * can see its own thirteen tiles; the whole puzzle is that you cannot. The
 * other seats take their real relative positions from the observer: shimocha
 * right, kamicha left. Each pond is rotated to face its own player, so fill
 * order and the sideways riichi tile read correctly from that seat — which is
 * what makes the table look like the game.
 *
 * Ponds are absolutely positioned rather than laid out in a grid: a CSS
 * rotation does not affect layout, so a rotated block in normal flow would
 * still reserve its unrotated footprint and the table would come out lopsided.
 */
export function Table({
  puzzle,
  handSelect = null,
  maxHeight = null,
}: {
  puzzle: Puzzle
  /** When set, your own hand below the table doubles as the answer input. */
  handSelect?: HandSelect | null
  /**
   * Height the whole block must fit inside, in CSS pixels.
   *
   * Width alone is the wrong constraint on a laptop: a column wide enough to
   * hold the table at full size still runs the river off the bottom of the
   * screen, and a river you have to scroll to reach is a river you will not
   * count. Given a budget, the table shrinks to whichever of the two bites
   * first. Null means width-only, as before.
   */
  maxHeight?: number | null
}) {
  const { target, others, round } = puzzle

  // Measured rather than assumed: the column width depends on the viewport, and
  // the table's own size depends on how many melds this particular hand has.
  const boxRef = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState(0)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The hand strip below the table scales with it, so the height budget has to
  // cover both. Measured rather than derived: its height depends on the tile
  // size and on whether the hand wrapped onto a second line.
  const handRef = useRef<HTMLDivElement>(null)
  const [handH, setHandH] = useState(0)
  // Re-attached per puzzle: the strip only exists when the viewer holds a hand,
  // so the node it observes comes and goes with the hand itself.
  useEffect(() => {
    const el = handRef.current
    if (!el) {
      setHandH(0)
      return
    }
    const ro = new ResizeObserver(([e]) => setHandH(e.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [puzzle])

  const bySeat = new Map<number, SeatView>()
  bySeat.set(target.seat, { ...target, isTarget: true })
  for (const o of others) bySeat.set(o.seat, { ...o, isTarget: false })

  // Sit opposite the target: the observer holds no hand in this puzzle, so the
  // seat we occupy is one whose concealed tiles we are not entitled to see.
  const viewer = (target.seat + 2) % 4
  const at = (offset: number) => bySeat.get((viewer + offset) % 4)!
  const seats: { seat: SeatView; orientation: Orientation }[] = [
    { seat: at(0), orientation: 'bottom' },
    { seat: at(1), orientation: 'right' },
    { seat: at(2), orientation: 'top' },
    { seat: at(3), orientation: 'left' },
  ]

  const seatWind = (seat: number) => WINDS[(seat - round.oya + 4) % 4]

  const self = at(0)
  const viewerHand = self.hand

  const size =
    2 * Math.max(INSET + POND_H + PLATE_GUTTER, meldReach(seats.map((s) => s.seat)))

  // Both budgets apply at once and the tighter one wins. The height one has to
  // discount the padding and the hand strip first, since those are what the
  // square table actually shares its budget with. Before the first measurement
  // `avail` is 0, so render unscaled and let the observer correct it.
  const byWidth = avail > 0 ? avail / size : 1
  const byHeight =
    maxHeight === null
      ? 1
      : Math.max(0, maxHeight - handH - BOX_CHROME) / size

  // The floor guards the height budget only. Trading a little scrolling for a
  // readable table is a fair trade vertically, where the overflow is a scroll
  // the page already supports. Horizontally it is not: the table is absolutely
  // positioned, so a width it refuses to meet does not scroll, it clips — and
  // the seats it cuts off are the left and right rivers, which is most of what
  // there is to read. On a phone the width is what binds, so it always wins.
  //
  // Growing past 1 is allowed, up to MAX_SCALE. The table is square and the
  // room around it rarely is, so on a large screen the binding budget stops
  // well short of the column and the surplus showed up as bare felt around a
  // small table. The art is a bitmap, so there is a point past which enlarging
  // only softens it — that is what the ceiling is for, not the layout.
  const scale = Math.min(MAX_SCALE, byWidth, Math.max(MIN_SCALE, byHeight))

  // Your hand is drawn outside the scaled block, so it has to be sized by hand
  // to keep step with it — left at a fixed size it shrank and grew out of
  // proportion to the very tiles it is meant to be compared against.
  const handTileW = Math.round(HAND_TILE_W * scale)

  return (
    <div
      ref={boxRef}
      className="rounded-2xl bg-felt-950 p-2 shadow-xl ring-1 ring-white/10"
    >
      {/* The table is laid out at its natural size and then scaled down to fit
          the column, rather than being scrolled. Every seat has to be visible
          at once to read the hand — a river you have to scroll to reach is a
          river you will not count. The wrapper keeps the scaled height so the
          page below does not overlap it. */}
      {/* The scaled box still occupies its unscaled width in layout, so it is
          centred by hand: `mx-auto` would centre the pre-scale footprint and
          leave the visible table sitting off to one side. */}
      <div style={{ height: size * scale }}>
        <div
          className="relative origin-top-left"
          style={{
            width: size,
            height: size,
            transform: `translateX(${Math.max(0, (avail - size * scale) / 2)}px) scale(${scale})`,
          }}
        >
          {seats.map(({ seat, orientation }) => (
            <SeatBlock
              key={seat.seat}
              seat={seat}
              orientation={orientation}
              wind={seatWind(seat.seat)}
              score={round.scores[seat.seat]}
            />
          ))}

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <CentreBox
              bakaze={round.bakaze}
              kyoku={round.kyoku}
              honba={round.honba}
              dora={round.doraMarkers}
              turn={puzzle.turn}
            />
          </div>
        </div>
      </div>

      {/* Your own hand, below the table. Drawn upright and at full size rather
          than inside the rotated seat block: it is the one hand you actually
          hold, and it is read, not just glanced at. Knowing your own tiles is
          real information — it is how you rule out waits by counting the
          copies you are sitting on. */}
      {viewerHand && viewerHand.length > 0 && (
        <div className="mx-auto mt-2 flex max-w-full flex-col items-center gap-1 border-t border-white/10 pt-3">
          <span className="text-[11px] uppercase tracking-wide text-white/40">
            Your hand
          </span>
          {/* Concealed tiles only. Your called sets are already on the table
              beside your pond, where everyone can see them; repeating them here
              would read as extra tiles still in hand. */}
          {/* The gap opens up when the hand is clickable: tiles butted together
              read as one block to point at, and the selection outlines of two
              adjacent copies would run into each other. */}
          <div
            ref={handRef}
            className={[
              'flex flex-wrap items-end justify-center',
              handSelect ? 'gap-1.5' : 'gap-px',
            ].join(' ')}
          >
            {viewerHand.map((t, i) => (
              <HandTile
                key={i}
                pai={t}
                width={handTileW}
                select={handSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * One tile of your own hand, clickable when the drill asks you to pick from it.
 *
 * The result colours match the ones the tile grid used: green for a safe tile
 * you named, amber for one you missed, red for a cut that deals in, and a fade
 * for everything already accounted for.
 */
function HandTile({
  pai,
  width,
  select,
}: {
  pai: Pai
  width: number
  select: HandSelect | null
}) {
  if (!select) return <Tile pai={pai} width={width} />

  // Red fives answer as their plain counterpart: safety is a property of the
  // face, and a hand holding 0p and 5p offers one answer, not two.
  const face = normalize(pai)
  const isSel = select.selected.includes(face)
  const answer = select.answer ? new Set(select.answer) : null
  const isAns = answer?.has(face) ?? false

  let ring = ''
  if (answer) {
    if (isAns && isSel) ring = 'outline outline-2 outline-offset-1 outline-emerald-500'
    else if (isAns) ring = 'outline outline-2 outline-offset-1 outline-amber-500'
    else if (isSel) ring = 'outline outline-2 outline-offset-1 outline-rose-500'
    else ring = 'opacity-40'
  }

  return (
    <Tile
      pai={pai}
      width={width}
      selected={isSel && !answer}
      onClick={select.disabled ? undefined : () => select.onToggle(face)}
      className={ring}
    />
  )
}

/**
 * One seat: its rotated pond, its melds just outside that pond, and an
 * upright nameplate on the table's outer edge.
 */
function SeatBlock({
  seat,
  orientation,
  wind,
  score,
}: {
  seat: SeatView
  orientation: Orientation
  wind: string
  score?: number
}) {
  const deg = ROTATION[orientation]

  // One rotated box per seat holds the pond and that seat's melds together,
  // so the melds travel with the pond instead of being positioned separately
  // and landing in the wrong corner for three of the four orientations.
  // AREA_W is wide enough for the pond plus a meld strip beside it.
  const AREA_W = POND_W + 2 * MELD_STRIP
  // Every plate sits centred on its own seat's edge, so each reads plainly as
  // belonging to the player it faces. The top and bottom seats have the table's
  // full width for this; the left and right ones only have the gutter, so their
  // plates stack the score under the wind to fit it without overlapping the
  // pond.
  const platePos: Record<Orientation, string> = {
    bottom: 'left-1/2 bottom-0 -translate-x-1/2',
    top: 'left-1/2 top-0 -translate-x-1/2',
    left: 'left-0 top-1/2 -translate-y-1/2',
    right: 'right-0 top-1/2 -translate-y-1/2',
  }
  const sideSeat = orientation === 'left' || orientation === 'right'

  return (
    <>
      <div
        className="absolute left-1/2 top-1/2 origin-center"
        style={{
          width: AREA_W,
          height: POND_H,
          marginLeft: -AREA_W / 2,
          marginTop: -POND_H / 2,
          transform: `rotate(${deg}deg) translateY(${INSET + POND_H / 2}px)`,
        }}
      >
        {/* The pond stays centred in the seat area whether or not there are
            melds; the meld strip hangs off its right edge without shifting
            it, so all four ponds line up around the centre box.

            The pond is anchored to the top — the edge facing the table centre.
            Anchored the other way, a seat with only one row of discards would
            push that row out to where its third row would have been, leaving a
            growing hole around the centre box for exactly the short rivers that
            need the least space.

            The melds stay anchored to the bottom, the outer edge. That is where
            a real client parks them, beside their owner rather than beside the
            centre, and it keeps the strip clear of the neighbouring seat's pond:
            swung inward it would reach across the corner into their discards. */}
        <div className="relative h-full" style={{ width: AREA_W }}>
          {/* Laid across the band between this pond and the centre box --
              the strip INSET already holds clear, and where a player would
              actually push the stick. Inside the rotated block, so it faces
              its own seat and lands in front of the right pond for all four. */}
          {seat.riichi && (
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{ top: -(STICK_H + 7) }}
            >
              <RiichiStick />
            </div>
          )}
          <div
            className="absolute top-0"
            style={{ left: (AREA_W - POND_W) / 2 }}
          >
            {/* Undo this seat's rotation for the caller badges only, so
                their kanji read upright the way the nameplates do. */}
            <Pond seat={seat} uprightDeg={-deg} />
          </div>
          {/* Melds sit past the pond's outer corner: out along the seat's own
              axis (bottom, the table's edge) and out across it (beyond the
              pond's far side). The corners are the emptiest part of the table,
              so parking the called sets there keeps them clearly distinct from
              the river without pushing the table any wider. */}
          {seat.melds.length > 0 && (
            <div
              className="absolute -bottom-2"
              style={{ left: (AREA_W + POND_W) / 2 + MELD_OFFSET }}
            >
              <PondMelds melds={seat.melds} />
            </div>
          )}
        </div>
      </div>

      <div className={`absolute ${platePos[orientation]}`}>
        <Nameplate
          wind={wind}
          score={score}
          isTarget={seat.isTarget}
          stacked={sideSeat}
        />
      </div>
    </>
  )
}

function CentreBox({
  bakaze,
  kyoku,
  honba,
  dora,
  turn,
}: {
  bakaze: string
  kyoku: number
  honba: number
  dora: string[]
  turn: number
}) {
  return (
    <div className="flex h-44 w-44 flex-col items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-felt-800/80 px-3 text-center">
      <p className="text-2xl font-semibold leading-none text-white">
        {WIND_KANJI[bakaze] ?? bakaze}
        {KYOKU_KANJI[kyoku - 1] ?? kyoku}局
      </p>
      <p className="text-sm leading-none text-white/60">
        {honba} 本場 · turn {turn}
      </p>
      <div className="mt-1 flex items-center gap-1">
        <span className="text-[11px] uppercase tracking-wide text-gold-300/80">
          dora
        </span>
        {dora.map((m, i) => (
          <Tile key={i} pai={doraFromMarker(m)} size="sm" />
        ))}
      </div>
    </div>
  )
}
