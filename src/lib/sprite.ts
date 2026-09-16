import { ALL_TILES } from './tiles'
import type { Pai } from './types'

/**
 * Column order of public/tiles.png, produced by tools/build_sprite.py:
 * the 34 base tiles in canonical order, then the three red fives.
 */
export const SPRITE_ORDER: Pai[] = [...ALL_TILES, '5mr', '5pr', '5sr']
export const SPRITE_COUNT = SPRITE_ORDER.length

const INDEX = new Map(SPRITE_ORDER.map((t, i) => [t, i]))

/** Column index for a tile, keeping red fives distinct from plain fives. */
export function spriteIndex(pai: Pai): number {
  return INDEX.get(pai) ?? INDEX.get(pai.length === 3 ? pai.slice(0, 2) : pai) ?? 0
}
