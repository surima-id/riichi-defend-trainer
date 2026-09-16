import { Tile } from './Tile'
import type { Meld, RiverTile } from '../lib/types'

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
export function Pond({ seat }: { seat: PondSeat }) {
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
              <PondTile key={i} tile={t} />
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

/** Where the sideways tile sits, by the seat the call was taken from. */
function rotatedIndex(meld: Meld): number {
  if (meld.type === 'ankan') return -1
  const n = meld.tiles.length
  switch (meld.fromOffset) {
    case 3:
      return 0 // kamicha — leftmost
    case 2:
      return 1 // toimen — middle
    case 1:
      return n - 1 // shimocha — rightmost
    default:
      return -1
  }
}

function MeldSet({ meld }: { meld: Meld }) {
  const rotAt = rotatedIndex(meld)
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
      {meld.tiles.map((t, j) => {
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
 * The seat's wind, score and riichi state.
 *
 * Kept upright regardless of which seat it belongs to — a rotated pond is how
 * a real table looks, but upside-down *text* is just hard to read.
 */
export function Nameplate({
  wind,
  score,
  riichi,
  isTarget,
  stacked = false,
}: {
  wind: string
  score?: number
  riichi: boolean
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
        {riichi && (
          <span className="rounded bg-rose-500/90 px-1 text-[8px] font-bold uppercase leading-tight tracking-wide text-white">
            riichi
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
      {riichi && (
        <span className="rounded bg-rose-500/90 px-1 py-px text-[9px] font-bold uppercase leading-tight tracking-wide text-white">
          riichi
        </span>
      )}
    </div>
  )
}

function PondTile({ tile }: { tile: RiverTile }) {
  const title = [
    tile.pai,
    tile.tsumogiri ? 'tsumogiri (cut from draw)' : 'TEDASHI (from hand)',
    tile.riichi ? '— riichi declaration' : '',
    tile.called ? '— called by another player' : '',
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
      faded={tile.called}
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
