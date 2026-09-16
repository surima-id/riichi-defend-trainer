import type { Pai } from './types'

export const SUITS = ['m', 'p', 's'] as const
export const HONORS = ['E', 'S', 'W', 'N', 'P', 'F', 'C'] as const

export const ALL_TILES: Pai[] = [
  ...SUITS.flatMap((s) => Array.from({ length: 9 }, (_, i) => `${i + 1}${s}`)),
  ...HONORS,
]

const ORDER = new Map(ALL_TILES.map((t, i) => [t, i]))

/** Strip the red-five marker: '5mr' -> '5m'. */
export function normalize(pai: Pai): Pai {
  return pai.length === 3 && pai.endsWith('r') ? pai.slice(0, 2) : pai
}

export function isRed(pai: Pai): boolean {
  return pai.length === 3 && pai.endsWith('r')
}

export function tileRank(pai: Pai): number {
  return ORDER.get(normalize(pai)) ?? 99
}

export function sortTiles(tiles: Pai[]): Pai[] {
  return [...tiles].sort((a, b) => tileRank(a) - tileRank(b))
}

const HONOR_LABEL: Record<string, string> = {
  E: 'East', S: 'South', W: 'West', N: 'North',
  P: 'Haku', F: 'Hatsu', C: 'Chun',
}

export function tileLabel(pai: Pai): string {
  const n = normalize(pai)
  return HONOR_LABEL[n] ?? n
}

/** The dora indicated by a marker, following the standard wrap rules. */
export function doraFromMarker(marker: Pai): Pai {
  const m = normalize(marker)
  if (HONOR_LABEL[m]) {
    const winds = ['E', 'S', 'W', 'N']
    const dragons = ['P', 'F', 'C']
    const wi = winds.indexOf(m)
    if (wi >= 0) return winds[(wi + 1) % 4]
    const di = dragons.indexOf(m)
    return dragons[(di + 1) % 3]
  }
  const num = Number(m[0])
  const suit = m[1]
  return `${num === 9 ? 1 : num + 1}${suit}`
}
