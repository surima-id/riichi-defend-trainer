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
  /** Marks the tile as claimed by another player. Purely additive: it draws a
   *  claim mark and changes nothing else about how the tile reads, so a called
   *  tedashi still looks exactly like any other tedashi. */
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

  // The dim is deliberately heavy — fully desaturated and darkened well below
  // the felt's own lightness. A subtle grey reads as "same tile, slightly off"
  // at pond scale; what makes the tedashi tiles pop in a real client is that
  // the tsumogiri ones recede into the mat entirely.
  //
  // `faded` deliberately changes nothing here. Being called away and being cut
  // from the draw are different facts, and dimming, fading or shrinking a
  // called tile all pulled it towards reading as tsumogiri — erasing the one
  // cue the pond exists to show. The claim mark carries it instead, so a
  // called tedashi sits at full strength beside every other tedashi.
  const filter = dimmed ? 'grayscale(1) brightness(.55) contrast(.95)' : undefined

  // Scaled to the tile so the mark stays proportional at every size.
  const bar = Math.max(2, Math.round(h * 0.075))

  return (
    <Element
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      title={title ?? tileLabel(pai)}
      aria-label={tileLabel(pai)}
      aria-pressed={interactive ? selected : undefined}
      style={{ width: w, height: h, ...(faded ? { zIndex: 1 } : {}) }}
      className={[
        // No `overflow-hidden` here: the claim mark overhangs the corner on
        // purpose, and clipping at the root would cut it in half. The art
        // layer clips itself instead, which is all the rounding was for.
        'relative shrink-0 rounded-[3px] bg-transparent p-0 transition',
        facedown ? 'border border-emerald-900/40 bg-emerald-800' : '',
        selected ? 'outline outline-2 outline-offset-1 outline-sky-500' : '',
        rotated ? 'rotate-90' : '',
        interactive ? 'cursor-pointer hover:-translate-y-0.5' : '',
        className,
      ].join(' ')}
    >
      {!facedown && (
        <span
          aria-hidden
          className="absolute inset-0 overflow-hidden rounded-[3px]"
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

      {/* The only thing that marks a called tile.
          Pinned to the top-right corner, clear of both the tile's number and
          the tedashi bar along the bottom edge. The offsets are set inline
          rather than as utility classes: `-right-px`/`-top-px` are not
          generated here, so the glyph kept its static position — bottom-left,
          directly on top of the tedashi bar, where it was invisible.
          U+FE0F forces emoji presentation so the glyph keeps its own colours
          instead of inheriting the surrounding white text, and the dark halo
          keeps it legible on a pale honour face as well as a dimmed one. */}
      {faded && !facedown && (
        <span
          aria-hidden
          className="pointer-events-none absolute leading-none"
          style={{
            // Hung off the corner rather than tucked inside it, so it reads as
            // a badge on the tile instead of part of the tile's own face.
            top: -Math.round(h * 0.07),
            right: -Math.round(w * 0.1),
            fontSize: Math.max(9, Math.round(h * 0.3)),
            textShadow: '0 0 2px rgba(0,0,0,.9), 0 0 4px rgba(0,0,0,.6)',
          }}
        >
          {'\u{1F590}\uFE0F'}
        </span>
      )}

      {/* Keep the tile name in the accessibility tree without showing it. */}
      <span className="sr-only">{normalize(pai)}</span>
    </Element>
  )
}
