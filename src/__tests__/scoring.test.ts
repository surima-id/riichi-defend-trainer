import { describe, expect, it } from 'vitest'
import { scoreGuess } from '../lib/scoring'

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
