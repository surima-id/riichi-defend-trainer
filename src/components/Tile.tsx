import { isRed, normalize, tileLabel } from '../lib/tiles'
import { spriteIndex, SPRITE_COUNT } from '../lib/sprite'
import type { Pai } from '../lib/types'

export type TileSize = 'sm' | 'md' | 'lg'

/** Rendered widths; the sheet cell is 104x128, so height = width * 128/104.
 *  Sized to read comfortably at a glance, close to Tenhou's own scale. */
const WIDTHS: Record<TileSize, number> = { sm: 34, md: 44, lg: 56 }
const ASPECT = 128 / 104

interface TileProps {
  pai: Pai
  size?: TileSize
  /** Greys the tile — used for tsumogiri river tiles, which carry no
   *  information about the hand's shape. */
  dimmed?: boolean
  /** Draws the tedashi bar. Kept separate from `dimmed` so the cue survives
   *  on tiles whose own art is already dark. */
  tedashi?: boolean
  /** Knocks the tile back — used for discards another player called away. */
  faded?: boolean
  selected?: boolean
  rotated?: boolean
  /** Face-down, for the outer tiles of an ankan. */
  facedown?: boolean
  onClick?: () => void
  title?: string
  className?: string
}

/**
 * A single mahjong tile, drawn from the sprite sheet in public/tiles.png.
 *
 * The art already includes the tile face and its drop shadow, so the element
 * carries no border of its own; selection and result states are shown with an
 * outline ring that sits outside the artwork.
 *
 * Three independent things can be true of one river tile — it was cut from the
 * hand, it was called away, and it is a red five — so each gets its own
 * channel. The dimming is a CSS `filter`, but the aka and tedashi marks are
 * separate unfiltered overlays: `filter` is a single property, so stacking
 * these as competing filter classes meant the last one silently won and the
 * others were never drawn. Greyscale also destroys the only thing that marks
 * an aka (its red face), which is why that mark cannot itself be filtered.
 */
export function Tile({
  pai,
  size = 'md',
  dimmed = false,
  tedashi = false,
  faded = false,
  selected = false,
  rotated = false,
  facedown = false,
  onClick,
  title,
  className = '',
}: TileProps) {
  const w = WIDTHS[size]
  const h = Math.round(w * ASPECT)
  const idx = spriteIndex(pai)
  const aka = isRed(pai)

  const interactive = Boolean(onClick)
  const Element = interactive ? 'button' : 'div'

  // Composed into one property so the two states stack instead of replacing
  // each other. A called tsumogiri tile is both greyed and knocked back.
  //
  // The dim is deliberately heavy — fully desaturated and darkened well below
  // the felt's own lightness. A subtle grey reads as "same tile, slightly off"
  // at pond scale; what makes the tedashi tiles pop in a real client is that
  // the tsumogiri ones recede into the mat entirely.
  const filter =
    [
      dimmed ? 'grayscale(1) brightness(.55) contrast(.95)' : '',
      faded ? 'grayscale(1) brightness(.75)' : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined

  // Scaled to the tile so the mark stays proportional at every size.
  const bar = Math.max(2, Math.round(h * 0.075))

  return (
    <Element
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      title={title ?? tileLabel(pai)}
      aria-label={tileLabel(pai)}
      aria-pressed={interactive ? selected : undefined}
      style={{
        width: w,
        height: h,
        ...(faded ? { opacity: 0.6 } : {}),
      }}
      className={[
        'relative shrink-0 overflow-hidden rounded-[3px] bg-transparent p-0 transition',
        facedown ? 'border border-emerald-900/40 bg-emerald-800' : '',
        selected ? 'outline outline-2 outline-offset-1 outline-sky-500' : '',
        // A called tile is out of play, but still worth reading, so it is
        // shrunk and knocked back rather than hidden.
        faded ? 'scale-[.82]' : '',
        rotated ? 'rotate-90' : '',
        interactive ? 'cursor-pointer hover:-translate-y-0.5' : '',
        className,
      ].join(' ')}
    >
      {!facedown && (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/tiles.png)',
            // Scale the sheet so one cell fills the element exactly.
            backgroundSize: `${SPRITE_COUNT * 100}% 100%`,
            backgroundPosition: `${(idx / (SPRITE_COUNT - 1)) * 100}% 0`,
            backgroundRepeat: 'no-repeat',
            filter,
          }}
        />
      )}

      {/* A red five is marked by an inset red frame rather than by its own
          artwork, so it stays identifiable once the tile is greyed. */}
      {aka && !facedown && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[3px]"
          style={{ boxShadow: 'inset 0 0 0 2px rgb(244 63 94)' }}
        />
      )}

      {/* Tedashi: a solid bar on the edge nearest the tile's owner. A shape
          cue, not a colour cue, so it reads the same on a dark sou tile as on
          a light honour, and it stays legible on the undimmed tile. */}
      {tedashi && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-sky-300"
          style={{ height: bar }}
        />
      )}

      {/* Keep the tile name in the accessibility tree without showing it. */}
      <span className="sr-only">{normalize(pai)}</span>
    </Element>
  )
}
