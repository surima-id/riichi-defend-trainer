import { describe, expect, it } from 'vitest'
import { meldLayout } from '../components/Pond'
import type { Meld } from '../lib/types'

function meld(
  type: Meld['type'], fromOffset: number, takenIndex: number, tiles: string[],
): Meld {
  return { type, fromOffset, takenIndex, tiles }
}

describe('called meld layout', () => {
  it('moves the claimed tile to the kamicha slot and rotates it there', () => {
    // 3s4s5s chi taken on the 4s. Chi is always from kamicha, so the claimed
    // tile belongs leftmost — not left in its sorted middle position.
    const { tiles, rotIndex } = meldLayout(meld('chi', 3, 1, ['3s', '4s', '5s']))
    expect(rotIndex).toBe(0)
    expect(tiles[rotIndex]).toBe('4s')
    expect(tiles).toEqual(['4s', '3s', '5s'])
  })

  it('puts a toimen call in the middle', () => {
    const { tiles, rotIndex } = meldLayout(meld('pon', 2, 0, ['7p', '7p', '7p']))
    expect(rotIndex).toBe(1)
    expect(tiles).toHaveLength(3)
  })

  it('puts a shimocha call rightmost', () => {
    const { tiles, rotIndex } = meldLayout(meld('pon', 1, 0, ['2m', '2m', '2m']))
    expect(rotIndex).toBe(2)
    expect(tiles).toHaveLength(3)
  })

  it('rotates nothing for a concealed kan and keeps its order', () => {
    const m = meld('ankan', 0, -1, ['2p', '2p', '2p', '2p'])
    const { tiles, rotIndex } = meldLayout(m)
    expect(rotIndex).toBe(-1)
    expect(tiles).toEqual(m.tiles)
  })

  it('keeps every tile of the set exactly once', () => {
    // The claimed tile is moved, not duplicated or dropped.
    const { tiles } = meldLayout(meld('chi', 3, 2, ['1m', '2m', '3m']))
    expect([...tiles].sort()).toEqual(['1m', '2m', '3m'])
  })

  it('places the called tile last in a shimocha kan', () => {
    const { tiles, rotIndex } = meldLayout(
      meld('daiminkan', 1, 0, ['5s', '5s', '5s', '5s']),
    )
    expect(rotIndex).toBe(3)
    expect(tiles).toHaveLength(4)
  })
})
