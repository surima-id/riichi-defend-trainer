import { describe, expect, it } from 'vitest'
import { MAX_WAIT_SELECTION, scoreGuess } from '../lib/scoring'
import { ALL_TILES } from '../lib/tiles'

describe('scoreGuess', () => {
  it('awards full points for an exact match', () => {
    const s = scoreGuess(['1s', '4s'], ['1s', '4s'])
    expect(s.exact).toBe(true)
    expect(s.points).toBe(100)
    expect(s.missed).toEqual([])
  })

  it('gives partial credit for a partially correct set', () => {
    const s = scoreGuess(['1s'], ['1s', '4s'])
    expect(s.exact).toBe(false)
    expect(s.hits).toEqual(['1s'])
    expect(s.missed).toEqual(['4s'])
    expect(s.points).toBeGreaterThan(0)
    expect(s.points).toBeLessThan(100)
  })

  it('penalises over-selection', () => {
    const broad = scoreGuess(['1s', '4s', '7s', '2m'], ['1s', '4s'])
    const tight = scoreGuess(['1s', '4s'], ['1s', '4s'])
    expect(broad.points).toBeLessThan(tight.points)
    expect(broad.falsePositives).toEqual(['7s', '2m'])
  })

  it('scores a complete miss at zero', () => {
    const s = scoreGuess(['9p'], ['1s', '4s'])
    expect(s.points).toBe(0)
    expect(s.hits).toEqual([])
  })

  it('treats red fives as their normal counterpart', () => {
    const s = scoreGuess(['5m'], ['5mr'])
    expect(s.exact).toBe(true)
  })

  it('handles an empty guess without dividing by zero', () => {
    const s = scoreGuess([], ['1s'])
    expect(s.f1).toBe(0)
    expect(s.points).toBe(0)
  })
})

describe('partial credit for a guess cast around the right tile', () => {
  it('rewards a near miss that brackets the wait', () => {
    // 3m is the wait; 1-2-3m is the classic "somewhere in this run" read.
    const s = scoreGuess(['1m', '2m', '3m'], ['3m'])
    expect(s.points).toBeGreaterThan(0)
    expect(s.hits).toEqual(['3m'])
  })

  it('keeps most of the marks for a three-tile bracket', () => {
    // A three-tile neighbourhood is most of the reading work, so it should
    // read as a good answer rather than as a rounding error.
    expect(scoreGuess(['1m', '2m', '3m'], ['3m']).points).toBeGreaterThan(50)
  })

  it('pays less the wider the net is cast', () => {
    const three = scoreGuess(['1m', '2m', '3m'], ['3m'])
    const six = scoreGuess(['1m', '2m', '3m', '4m', '5m', '6m'], ['3m'])
    const nine = scoreGuess(
      ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m'], ['3m'],
    )
    expect(three.points).toBeGreaterThan(six.points)
    expect(six.points).toBeGreaterThan(nine.points)
  })

  it('still pays something at the widest allowed guess', () => {
    const nine = scoreGuess(
      ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m'], ['3m'],
    )
    expect(nine.points).toBeGreaterThan(0)
  })

  it('never lets a wide guess beat the exact answer', () => {
    const exact = scoreGuess(['3m'], ['3m'])
    for (let n = 2; n <= MAX_WAIT_SELECTION; n++) {
      const wide = scoreGuess(ALL_TILES.slice(0, n), ['3m'])
      expect(wide.points).toBeLessThan(exact.points)
    }
  })

  it('does not charge a wide wait for its own width', () => {
    // Three tiles named, three tiles correct: the guess is exactly as wide as
    // the answer, so there is no vagueness to deduct for.
    const s = scoreGuess(['1s', '4s', '7s'], ['1s', '4s', '7s'])
    expect(s.exact).toBe(true)
    expect(s.points).toBe(100)
  })

  it('applies the same taper to open hands as to riichi', () => {
    // Scoring knows nothing about how the hand was declared, so an open hand
    // read to within a bracket is worth exactly what a riichi one is.
    const s = scoreGuess(['5p', '6p', '7p'], ['6p'])
    expect(s.points).toBe(scoreGuess(['1m', '2m', '3m'], ['2m']).points)
  })

  it('pays partial credit for finding some of a multi-sided wait', () => {
    const s = scoreGuess(['1s', '4s'], ['1s', '4s', '7s'])
    expect(s.points).toBeGreaterThan(0)
    expect(s.points).toBeLessThan(100)
    expect(s.missed).toEqual(['7s'])
  })
})
