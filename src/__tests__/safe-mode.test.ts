import { describe, expect, it } from 'vitest'
import { unpackPuzzle, type PackedPuzzle } from '../lib/unpack'

/** Minimal packed puzzle; only the answer fields matter here. */
function packed(a: string[], x?: string[]): PackedPuzzle {
  return {
    t: { s: 0, r: [] },
    o: [{ s: 2, r: [], h: ['1m', '3m', '9s'] }],
    b: 'E', k: 1, h: 0, d: ['1z'], y: 0, a, n: 0, u: 6,
    ...(x ? { x } : {}),
  }
}

describe('ron-able waits', () => {
  it('falls back to the full wait set when the packed field is absent', () => {
    // Most hands hold a yaku, so the two sets agree and only one is shipped.
    const p = unpackPuzzle(packed(['3m', '6p']), 0)
    expect(p.ronAnswer).toEqual(['3m', '6p'])
  })

  it('keeps the narrower ron set when the hand is partly yakuless', () => {
    const p = unpackPuzzle(packed(['3m', '6p'], ['3m']), 0)
    expect(p.answer).toEqual(['3m', '6p'])
    expect(p.ronAnswer).toEqual(['3m'])
  })

  it('represents a fully yakuless hand as an empty ron set', () => {
    const p = unpackPuzzle(packed(['3m', '6p'], []), 0)
    expect(p.answer).toHaveLength(2)
    expect(p.ronAnswer).toEqual([])
  })
})
