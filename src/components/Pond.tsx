import { Tile } from './Tile'
import type { Meld, Pai, RiverTile } from '../lib/types'

/** Tenhou lays the pond out six tiles to a row; the last row runs long. */
export const ROW_LENGTH = 6

export const TILE_W = 34
const ASPECT = 128 / 104
export const TILE_H = Math.round(TILE_W * ASPECT)

const GAP = 3

/** Unrotated footprint of a pond block: 6 columns by 3 rows. */
export const POND_W = ROW_LENGTH * (TILE_W + GAP)
export const POND_H = 3 * (TILE_H + GAP)

const WIND_KANJI: Record<string, string> = { E: '東', S: '南', W: '西', N: '北' }

/** Spelled out for the tooltip, where a lone kanji is less help than a word. */
const WIND_NAME: Record<string, string> = {
  E: 'East (東)', S: 'South (南)', W: 'West (西)', N: 'North (北)',
}

export type Orientation = 'bottom' | 'right' | 'top' | 'left'

/**
 * Degrees each seat's pond is turned so it faces that seat, exactly as an
 * online client draws it: your own discards read upright to you, and the other
 * three are turned towards their owners.
 */
export const ROTATION: Record<Orientation, number> = {
  bottom: 0,
  left: 90,
  top: 180,
  right: 270,
}

interface PondSeat {
  seat: number
  river: RiverTile[]
  melds: Meld[]
  riichi: boolean
  isTarget: boolean
}

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

/**
 * One seat's discard pond, drawn in its own frame of reference.
 *
 * The caller rotates this block into place, so here it is always "bottom
 * seat": rows fill left-to-right, top-to-bottom, away from the owner. That
 * keeps the riichi tile's sideways orientation and the fill order correct
 * from the owner's point of view once rotated.
 */
export function Pond({ seat, uprightDeg = 0 }: {
  seat: PondSeat
  /** Inverse of this pond's rotation, so caller badges stay readable. */
  uprightDeg?: number
}) {
  const rows = chunk(seat.river, ROW_LENGTH)

  return (
    <div
      className="flex flex-col items-center"
      style={{ width: POND_W, gap: GAP }}
    >
      {rows.length === 0 ? (
        <span className="text-[10px] text-white/25">—</span>
      ) : (
        rows.map((row, r) => (
          <div key={r} className="flex items-end self-start" style={{ gap: GAP }}>
            {row.map((t, i) => (
              <PondTile key={i} tile={t} uprightDeg={uprightDeg} />
            ))}
          </div>
        ))
      )}
    </div>
  )
}

/**
 * A seat's melds, drawn in the same rotated frame as its pond.
 *
 * Real clients park called sets on the owner's right-hand side, outside the
 * pond. The tile that was called is laid sideways, and *where* it sits in the
 * set says who it came from: leftmost for kamicha (the player to your left),
 * middle for toimen, rightmost for shimocha. That is the only visual record of
 * who fed the call, so it matters for reading the table.
 *
 * Sets stack outward from the pond rather than running side by side. A row of
 * three or four calls is wider than the pond it sits beside, which forced the
 * whole table to grow just to keep the last set on screen; stacked, a seat
 * occupies the same width however many times it has called, so the table stays
 * one size. Each set still reads left-to-right internally, so the rotated tile
 * keeps pointing at whoever fed the call.
 */
export function PondMelds({ melds }: { melds: Meld[] }) {
  if (melds.length === 0) return null
  return (
    <div className="flex flex-col items-start gap-1">
      {melds.map((m, i) => (
        <MeldSet key={i} meld={m} />
      ))}
    </div>
  )
}

/**
 * Lay out a called set the way a real table does.
 *
 * The called tile is not left where sorting happens to put it: it is *moved*
 * to the slot that names the seat it came from — leftmost for kamicha (your
 * left), middle for toimen, rightmost for shimocha — and laid sideways there.
 * The remaining tiles keep their sorted order around it.
 *
 * Both facts therefore hold at once, which is the point: the rotated tile is
 * the tile that was actually claimed *and* its position says who fed it. A
 * chi of 3s4s5s taken on the 4s reads "4s 3s 5s" with the 4s sideways at the
 * left, not "3s 4s 5s" with the middle turned.
 *
 * Returns the display order plus the index that is laid sideways, so the
 * caller does not have to recompute the mapping.
 */
export function meldLayout(meld: Meld): { tiles: Pai[]; rotIndex: number } {
  // A concealed kan was never called, so nothing rotates and the ends are the
  // two tiles drawn face-down.
  if (meld.type === 'ankan' || meld.fromOffset === 0) {
    return { tiles: meld.tiles, rotIndex: -1 }
  }

  const n = meld.tiles.length
  const slot =
    meld.fromOffset === 3
      ? 0                // kamicha — leftmost
      : meld.fromOffset === 2
        ? 1              // toimen — middle
        : n - 1          // shimocha — rightmost

  // Pull the claimed tile out and let the rest close up around its new slot.
  const i =
    meld.takenIndex >= 0 && meld.takenIndex < n ? meld.takenIndex : 0
  const rest = meld.tiles.filter((_, k) => k !== i)
  const tiles = [...rest.slice(0, slot), meld.tiles[i], ...rest.slice(slot)]
  return { tiles, rotIndex: slot }
}

function MeldSet({ meld }: { meld: Meld }) {
  const { tiles, rotIndex: rotAt } = meldLayout(meld)
  const label =
    meld.fromOffset === 3
      ? 'from kamicha (left)'
      : meld.fromOffset === 2
        ? 'from toimen (across)'
        : meld.fromOffset === 1
          ? 'from shimocha (right)'
          : 'concealed'

  return (
    <div className="flex items-end gap-px" title={`${meld.type} — ${label}`}>
      {tiles.map((t, j) => {
        const sideways = j === rotAt
        const tile = (
          <Tile
            pai={t}
            size="sm"
            rotated={sideways}
            facedown={meld.type === 'ankan' && (j === 0 || j === 3)}
          />
        )
        if (!sideways) return <span key={j}>{tile}</span>
        return (
          <span
            key={j}
            className="flex shrink-0 items-center justify-center"
            style={{ width: TILE_H, height: TILE_W }}
          >
            {tile}
          </span>
        )
      })}
    </div>
  )
}

/**
 * A 1000-point riichi stick, laid in front of its owner's pond.
 *
 * This is how a real table announces a riichi: the declarer pushes a tenbou
 * out in front of their discards and it stays there for the rest of the hand.
 * It reads at a glance from across the table, which a text label beside the
 * nameplate never quite does, and the band between the ponds and the centre
 * box is empty anyway.
 *
 * Drawn rather than photographed: a white bar with the single red spot that
 * distinguishes the 1000-point stick from the other denominations.
 */
export const STICK_W = POND_W * 0.62
export const STICK_H = 9

export function RiichiStick() {
  return (
    <div
      className="flex items-center justify-center rounded-[2px] bg-gradient-to-b from-white to-white/80 shadow-[0_1px_3px_rgba(0,0,0,.55)] ring-1 ring-black/25"
      style={{ width: STICK_W, height: STICK_H }}
      title="Riichi declared — 1000 point stick"
    >
      {/* The lone red dot is the 1000-point stick's own marking. */}
      <span className="h-[3px] w-[3px] rounded-full bg-rose-500" />
    </div>
  )
}

/**
 * The seat's wind and score.
 *
 * Kept upright regardless of which seat it belongs to — a rotated pond is how
 * a real table looks, but upside-down *text* is just hard to read. Riichi is
 * not shown here: the stick in front of the pond says it, the way a real
 * table does.
 */
export function Nameplate({
  wind,
  score,
  isTarget,
  stacked = false,
}: {
  wind: string
  score?: number
  isTarget: boolean
  /**
   * Stack the wind over the score instead of setting them side by side.
   *
   * The left and right seats only have the width of the gutter to sit in —
   * far less than a horizontal plate needs — so laid out in a row they spill
   * over their own pond. Stacked, the plate is narrow enough to sit in the
   * gutter beside the seat it belongs to, which is where it reads as theirs.
   */
  stacked?: boolean
}) {
  if (stacked) {
    return (
      <div className="flex w-14 flex-col items-center gap-0.5">
        <span
          className={[
            'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
            isTarget
              ? 'bg-gold-400 text-felt-950 ring-2 ring-gold-300/60'
              : 'bg-felt-700 text-felt-100',
          ].join(' ')}
          title={isTarget ? 'The seat you are reading' : undefined}
        >
          {WIND_KANJI[wind] ?? wind}
        </span>
        {score !== undefined && (
          <span className="text-xs tabular-nums leading-none text-white/75">
            {score}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span
        className={[
          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
          isTarget
            ? 'bg-gold-400 text-felt-950 ring-2 ring-gold-300/60'
            : 'bg-felt-700 text-felt-100',
        ].join(' ')}
        title={isTarget ? 'The seat you are reading' : undefined}
      >
        {WIND_KANJI[wind] ?? wind}
      </span>
      {score !== undefined && (
        <span className="text-sm tabular-nums text-white/75">{score}</span>
      )}
    </div>
  )
}

function PondTile({ tile, uprightDeg = 0 }: {
  tile: RiverTile
  uprightDeg?: number
}) {
  const title = [
    tile.pai,
    tile.tsumogiri ? 'tsumogiri (cut from draw)' : 'TEDASHI (from hand)',
    tile.riichi ? '— riichi declaration' : '',
    tile.calledBy ? `— called by ${WIND_NAME[tile.calledBy] ?? tile.calledBy}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const inner = (
    <Tile
      pai={tile.pai}
      size="sm"
      dimmed={tile.tsumogiri}
      tedashi={!tile.tsumogiri}
      rotated={tile.riichi}
      calledBy={tile.calledBy}
      // The riichi tile is itself turned 90deg, so its badge needs that
      // undone too on top of the pond's own rotation.
      uprightDeg={uprightDeg - (tile.riichi ? 90 : 0)}
      title={title}
    />
  )

  if (!tile.riichi) return inner

  // A sideways tile occupies a wider, shorter slot; the row aligns on its base.
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{ width: TILE_H, height: TILE_W }}
    >
      {inner}
    </span>
  )
}
