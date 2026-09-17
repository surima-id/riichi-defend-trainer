import { isRed, normalize, tileLabel } from '../lib/tiles'
import { spriteIndex, SPRITE_COUNT } from '../lib/sprite'
import type { Pai } from '../lib/types'

export type TileSize = 'sm' | 'md' | 'lg'

/** Rendered widths; the sheet cell is 104x128, so height = width * 128/104.
 *  Sized to read comfortably at a glance, close to Tenhou's own scale. */
const WIDTHS: Record<TileSize, number> = { sm: 34, md: 44, lg: 56 }
const ASPECT = 128 / 104


/** The badge names the caller by wind, the way the table itself does. */
const WIND_KANJI: Record<string, string> = {
  E: '東', S: '南', W: '西', N: '北',
}

interface TileProps {
  pai: Pai
  size?: TileSize
  /** Greys the tile — used for tsumogiri river tiles, which carry no
   *  information about the hand's shape. */
  dimmed?: boolean
  /** Draws the tedashi bar. Kept separate from `dimmed` so the cue survives
   *  on tiles whose own art is already dark. */
  tedashi?: boolean
  /**
   * Seat wind of the player who called this tile away, or null.
   *
   * Purely additive: it draws a badge and changes nothing else about how the
   * tile reads, so a called tedashi still looks exactly like any other
   * tedashi. Naming the caller rather than just marking the tile is what lets
   * two identical tiles called by different players be told apart.
   */
  calledBy?: string | null
  selected?: boolean
  rotated?: boolean
  /** Face-down, for the outer tiles of an ankan. */
  facedown?: boolean
  /**
   * The most recent discard on the table — drawn with a ring so it can be
   * picked out of a full pond at a glance.
   */
  latest?: boolean
  /**
   * Exact rendered width in pixels, overriding `size`.
   *
   * For a caller that has measured the room it has and wants the tile to fill
   * it — the answer grid sizes its nine tiles to the column rather than
   * picking from the three fixed sizes and hoping. The height follows from
   * ASPECT either way, so a tile given a width is still a tile in proportion.
   */
  width?: number
  /**
   * Degrees to turn the caller badge so it stays upright.
   *
   * Each pond is rotated to face its own seat, which is right for the tiles
   * but turns the badge's kanji with them — and upside-down text is simply
   * hard to read, the same reason the nameplates stay upright. The caller
   * passes the inverse of its own rotation.
   */
  uprightDeg?: number
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
  calledBy = null,
  selected = false,
  rotated = false,
  facedown = false,
  latest = false,
  width,
  uprightDeg = 0,
  onClick,
  title,
  className = '',
}: TileProps) {
  // A measured width wins over the named size; the height is derived from it
  // either way, so the art is never stretched out of its own proportions.
  const w = width ?? WIDTHS[size]
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
  // `calledBy` deliberately changes nothing here. Being called away and being
  // cut from the draw are different facts, and dimming, fading or shrinking a
  // called tile all pulled it towards reading as tsumogiri — erasing the one
  // cue the pond exists to show. The badge carries it instead, so a called
  // tedashi sits at full strength beside every other tedashi.
  const filter = dimmed ? 'grayscale(1) brightness(.55) contrast(.95)' : undefined

  // Scaled to the tile so the marks stay proportional at every size.
  const bar = Math.max(2, Math.round(h * 0.075))
  const badge = Math.max(11, Math.round(h * 0.34))

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
        // Both the ring and the badge overhang the tile, so either has to
        // outrank the neighbours that paint after it.
        ...(calledBy || latest ? { zIndex: 1 } : {}),
      }}
      className={[
        // No `overflow-hidden` here: the claim mark overhangs the corner on
        // purpose, and clipping at the root would cut it in half. The art
        // layer clips itself instead, which is all the rounding was for.
        'relative shrink-0 rounded-[3px] bg-transparent p-0 transition',
        // A face-down tile is a real tile, so it has to read as one against
        // the felt. The old dark emerald sat at almost the mat's own
        // lightness, which made the outer tiles of an ankan nearly vanish --
        // exactly the meld where knowing a tile is there matters.
        facedown ? 'border border-gold-300/35 bg-felt-950' : '',
        selected ? 'outline outline-2 outline-offset-1 outline-sky-500' : '',
        // The newest discard. An outline rather than a filter or a badge:
        // the tile already spends its art on tedashi/tsumogiri and its corner
        // on the caller badge, and a ring sits outside both without competing
        // with either. Gold matches the highlight on the seat being read.
        latest ? 'outline outline-2 outline-offset-1 outline-gold-300' : '',
        rotated ? 'rotate-90' : '',
        interactive ? 'cursor-pointer hover:-translate-y-0.5' : '',
        className,
      ].join(' ')}
    >
      {/* The Surima emblem, gold on a dark back. Drawn as a background image
          rather than an <img> so it scales with the tile and needs no layout
          of its own; inset so the mark sits clear of the tile's border. */}
      {facedown && (
        <span
          aria-hidden
          className="absolute inset-0 bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/tile-back.png)',
            backgroundSize: '72%',
            opacity: 0.92,
          }}
        />
      )}

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

      {/* The only thing that marks a called tile: a badge naming the seat that
          took it. A bare claim mark could not answer "called by whom" when two
          players call the same tile face, which is exactly when the pond is
          hardest to read.
          Hung off the top-right corner, clear of both the tile's number and
          the tedashi bar along the bottom edge. The offsets are set inline
          rather than as utility classes: `-right-px`/`-top-px` are not
          generated here, so an earlier mark kept its static position —
          bottom-left, on top of the tedashi bar, where it was invisible. */}
      {calledBy && !facedown && (
        <span
          aria-hidden
          className="pointer-events-none absolute flex items-center justify-center rounded-full font-bold text-white ring-1 ring-black/40"
          style={{
            top: -Math.round(h * 0.06),
            right: -Math.round(w * 0.12),
            width: badge,
            height: badge,
            fontSize: Math.round(badge * 0.72),
            // Amber rather than the felt palette: the badge has to separate
            // from the tile art beneath it at every suit, and nothing else on
            // the table is this colour.
            backgroundColor: 'rgb(217 119 6)',
            lineHeight: 1,
            // Turned back against the pond's own rotation. The badge is a
            // circle, so spinning it moves no layout and only rights the text.
            ...(uprightDeg ? { transform: `rotate(${uprightDeg}deg)` } : {}),
          }}
        >
          {WIND_KANJI[calledBy] ?? calledBy}
        </span>
      )}

      {/* Keep the tile name in the accessibility tree without showing it. */}
      <span className="sr-only">{normalize(pai)}</span>
    </Element>
  )
}
