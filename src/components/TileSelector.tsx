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

export function TileSelector({
  selected, onToggle, disabled, reveal, atCap = false,
}: TileSelectorProps) {
  const sel = new Set(selected)
  const answer = reveal ? new Set(reveal.answer.map((t) => t)) : null
  const groups = GROUPS

  return (
    <div className="space-y-2.5">
      {groups.map((g) => (
        <div key={g.label} className="flex items-center gap-1.5">
          <span className="w-9 shrink-0 text-xs font-medium text-white/50">
            {g.label}
          </span>
          {/* `flex-nowrap`: a suit is read as the run 1-9, and a row that wraps
              after the fifth tile turns that run into two half-rows you have to
              reassemble before you can point at 6p. The tiles are sized so all
              nine fit the sidebar.
              On a narrow phone nine tiles do not fit at their natural width,
              so they are allowed to squeeze; below the width where they stay
              nameable the row wraps instead of pushing the page sideways. */}
          <div className="flex min-w-0 flex-wrap gap-1 sm:flex-nowrap">
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
                  size="sm"
                  selected={isSel && !answer}
                  onClick={disabled || blocked ? undefined : () => onToggle(t)}
                  // Allowed to give ground rather than overflow the page. The
                  // art is a background image sized to the element, so a
                  // squeezed tile stays a whole tile, just narrower.
                  shrinkable
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
