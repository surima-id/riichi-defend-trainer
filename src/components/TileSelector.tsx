import { useEffect, useRef, useState } from 'react'
import { ALL_TILES } from '../lib/tiles'
import { Tile } from './Tile'
import type { Pai } from '../lib/types'

interface TileSelectorProps {
  selected: Pai[]
  onToggle: (pai: Pai) => void
  disabled?: boolean
  /** After submitting, mark which tiles were right and wrong. */
  reveal?: { answer: Pai[] } | null
  /**
   * The selection limit has been reached, so no further tile can be added.
   *
   * Unselected tiles go flat and lose their pointer while this holds, rather
   * than staying live and silently ignoring the click. Already-selected tiles
   * stay clickable — you always have to be able to take a tile back.
   */
  atCap?: boolean
}

const GROUPS: { label: string; tiles: Pai[] }[] = [
  { label: 'Man', tiles: ALL_TILES.slice(0, 9) },
  { label: 'Pin', tiles: ALL_TILES.slice(9, 18) },
  { label: 'Sou', tiles: ALL_TILES.slice(18, 27) },
  { label: 'Honors', tiles: ALL_TILES.slice(27) },
]

/** Widest row: a suit laid out 1-9. The tiles are sized to fit this. */
const COLUMNS = 9

/** The `gap-1` between tiles in a row. */
const GAP = 4

/**
 * Bounds on the size the measured width is allowed to produce.
 *
 * The upper bound is what a tile is worth as a target — past it the row is
 * just further for the eye and the cursor to travel, and the grid starts to
 * compete with the table for attention. The lower is where a tile stops being
 * nameable at a glance, below which the row wraps rather than shrinking on.
 */
const MAX_TILE_W = 46
const MIN_TILE_W = 26

export function TileSelector({
  selected, onToggle, disabled, reveal, atCap = false,
}: TileSelectorProps) {
  const sel = new Set(selected)
  const answer = reveal ? new Set(reveal.answer.map((t) => t)) : null
  const groups = GROUPS

  // Tiles are sized from the room the column actually has, rather than picked
  // from the fixed sizes and left to fit or not. The earlier version squeezed
  // the width and kept the height, which made every tile in the grid taller
  // than it was wide — the one place in the app where a tile did not look like
  // the tiles on the table beside it.
  const rowRef = useRef<HTMLDivElement>(null)
  const [rowW, setRowW] = useState(0)
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setRowW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fitted = Math.floor((rowW - (COLUMNS - 1) * GAP) / COLUMNS)
  const tileW = rowW > 0
    ? Math.max(MIN_TILE_W, Math.min(MAX_TILE_W, fitted))
    : undefined

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.label} className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-xs font-medium text-white/50">
            {g.label}
          </span>
          {/* A suit is read as the run 1-9, and a row that wraps mid-suit turns
              that run into two half-rows you have to reassemble before you can
              point at 6p — so the tiles are sized to put all nine on one line.
              Wrapping is left enabled as the escape hatch: on a phone too
              narrow even for MIN_TILE_W the row gives way rather than pushing
              the page sideways. */}
          <div ref={g.label === 'Man' ? rowRef : undefined} className="flex min-w-0 flex-wrap gap-1">
            {g.tiles.map((t) => {
              const isSel = sel.has(t)
              const isAns = answer?.has(t) ?? false
              const blocked = atCap && !isSel
              let ring = blocked ? 'opacity-30' : ''
              if (answer) {
                if (isAns && isSel) ring = 'outline outline-2 outline-offset-1 outline-emerald-500'
                else if (isAns) ring = 'outline outline-2 outline-offset-1 outline-amber-500'
                else if (isSel) ring = 'outline outline-2 outline-offset-1 outline-rose-500'
                else ring = 'opacity-40'
              }
              return (
                <Tile
                  key={t}
                  pai={t}
                  width={tileW}
                  selected={isSel && !answer}
                  onClick={disabled || blocked ? undefined : () => onToggle(t)}
                  className={ring}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
