import { describe, expect, it } from 'vitest'

/**
 * The replay derives how many melds existed on a given turn from that turn's
 * hand size, because the puzzle only stores the hand's final melds. A hand
 * with n calls holds 13 - 3n concealed tiles.
 */
function meldCount(handSize: number): number {
  return Math.max(0, Math.round((13 - handSize) / 3))
}

describe('melds visible at a given turn', () => {
  it('shows no melds while the hand is still concealed', () => {
    expect(meldCount(13)).toBe(0)
  })

  it('reveals one meld only once the hand drops to ten tiles', () => {
    expect(meldCount(10)).toBe(1)
  })

  it('tracks further calls', () => {
    expect(meldCount(7)).toBe(2)
    expect(meldCount(4)).toBe(3)
    expect(meldCount(1)).toBe(4)
  })

  it('never returns a negative count', () => {
    expect(meldCount(14)).toBe(0)
  })

  it('matches the real turn-12 pon from puzzle 0', () => {
    // Concealed for eleven turns, then a pon of 4s drops the hand to ten.
    const sizes = [13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 10, 10]
    expect(sizes.map(meldCount)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
    ])
  })
})

describe('history deltas that only remove tiles', () => {
  it('shrinks the hand on a call, which adds nothing back', () => {
    // A pon moves three tiles out of the concealed hand and returns none, so
    // the packed step carries `o` with no `i`.
    const steps = [
      { d: '1p', h: ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', 'F', 'F', 'F', 'E'] },
      { d: 'E', o: ['F', 'F', 'F'] },
    ]
    let hand: string[] = []
    for (const s of steps) {
      if (s.h) hand = [...s.h]
      else {
        for (const t of s.o ?? []) {
          const k = hand.indexOf(t)
          if (k >= 0) hand.splice(k, 1)
        }
      }
    }
    expect(hand).toHaveLength(10)
    expect(hand).not.toContain('F')
  })
})

describe('pre-discard hand reconstruction', () => {
  /** Only the post-discard hand is stored; the cut tile goes back to recover it. */
  function before(hand: string[], discard: string): string[] {
    return [...hand, discard]
  }

  it('recovers the fourteen tiles the player chose from', () => {
    const after = ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', 'E', 'E', 'S', 'S']
    expect(before(after, 'W')).toHaveLength(14)
  })

  it('keeps the drawn tile inside the pre-discard hand', () => {
    const after = ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', 'E', 'E', 'S', 'S']
    expect(before(after, '5p')).toContain('5p')
  })

  it('reconstructs a called turn, where there is no draw', () => {
    // Ten concealed tiles after one call; the cut tile returns to make eleven.
    const after = ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', 'E']
    expect(before(after, 'S')).toHaveLength(11)
  })
})
