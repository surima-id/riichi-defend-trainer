import { describe, expect, it } from 'vitest'
import { unpackPuzzle, type PackedPuzzle } from '../lib/unpack'
import fixture from './history.fixture.json'

/** Wrap packed steps in a minimal puzzle so we can exercise unpackHistory. */
function withHistory(z: unknown): PackedPuzzle {
  return {
    t: { s: 0, r: [] },
    o: [],
    b: 'E', k: 1, h: 0, d: ['1m'], y: 0, a: [], n: 1, u: 1,
    z,
  } as PackedPuzzle
}

describe('history unpacking', () => {
  const steps = unpackPuzzle(withHistory(fixture.packed), 0).history

  it('restores every turn', () => {
    expect(steps).toHaveLength(fixture.expect.length)
  })

  it('reconstructs each hand exactly from the deltas', () => {
    // This is the round-trip that matters: the packed form stores only the
    // first hand plus per-turn diffs, so a bug here silently corrupts the
    // replay the user is shown after answering.
    steps.forEach((s, i) => {
      expect([...s.hand].sort()).toEqual([...fixture.expect[i].hand].sort())
    })
  })

  it('keeps every hand at a legal size', () => {
    for (const s of steps) expect(s.hand.length).toBe(13)
  })

  it('carries waits forward until they change', () => {
    steps.forEach((s, i) => {
      expect(s.waits).toEqual(fixture.expect[i].waits)
    })
  })

  it('preserves draw, discard and tsumogiri per turn', () => {
    steps.forEach((s, i) => {
      const e = fixture.expect[i]
      expect(s.discard).toBe(e.discard)
      expect(s.tsumogiri).toBe(e.tsumogiri)
      expect(s.draw).toBe(e.draw)
    })
  })

  it('returns an empty history when none was packed', () => {
    expect(unpackPuzzle(withHistory(undefined), 0).history).toEqual([])
  })
})
