import { useEffect, useRef, useState } from 'react'
import {
  Nameplate,
  Pond,
  PondMelds,
  POND_H,
  POND_W,
  ROTATION,
  type Orientation,
} from './Pond'
import { Tile } from './Tile'
import { TILE_W, TILE_H } from './Pond'
import { doraFromMarker } from '../lib/tiles'
import type { Meld, Pai, Puzzle, RiverTile } from '../lib/types'

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
export function Table({ puzzle }: { puzzle: Puzzle }) {
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

  // Only ever shrink: a small table blown up to fill a wide column would look
  // worse than one sitting at its natural size. Before the first measurement
  // `avail` is 0, so render unscaled and let the observer correct it.
  const scale = avail > 0 ? Math.min(1, avail / size) : 1

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
          <div className="flex flex-wrap items-end justify-center gap-px">
            {viewerHand.map((t, i) => (
              <Tile key={i} pai={t} size="md" />
            ))}
          </div>
        </div>
      )}
    </div>
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
          riichi={seat.riichi}
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
