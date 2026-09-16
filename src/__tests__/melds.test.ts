import { describe, expect, it } from 'vitest'
import { unpackPuzzle, type PackedPuzzle } from '../lib/unpack'

/** Pack a single meld onto the target seat. */
function withMeld(m: [string, number, number, ...string[]]): PackedPuzzle {
  return {
    t: { s: 0, r: [], m: [m] },
    o: [], b: 'E', k: 1, h: 0, d: ['1z'], y: 0, a: ['1m'], n: 0, u: 6,
  }
}

describe('called meld rendering', () => {
  it('keeps the index of the tile that was actually called', () => {
    // A chi of 3s4s5s taken on the 4s: the claimed tile is the middle one,
    // even though the call came from kamicha, whose conventional position is
    // leftmost. Rotating by seat position would name the 3s instead.
    const p = unpackPuzzle(withMeld(['c', 3, 1, '3s', '4s', '5s']), 0)
    const m = p.target.melds[0]
    expect(m.takenIndex).toBe(1)
    expect(m.tiles[m.takenIndex]).toBe('4s')
  })

  it('records a concealed kan as having no called tile', () => {
    const p = unpackPuzzle(withMeld(['a', 0, -1, '2p', '2p', '2p', '2p']), 0)
    expect(p.target.melds[0].takenIndex).toBe(-1)
  })

  it('keeps the calling seat alongside the called tile', () => {
    // Both facts are needed: a pon is rotated by seat, since its tiles are
    // identical and position is the only record of who fed the call.
    const p = unpackPuzzle(withMeld(['p', 2, 2, '7m', '7m', '7m']), 0)
    const m = p.target.melds[0]
    expect(m.fromOffset).toBe(2)
    expect(m.takenIndex).toBe(2)
  })
})
