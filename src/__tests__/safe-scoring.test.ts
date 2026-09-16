import { describe, expect, it } from 'vitest'
import { scoreSafeGuess } from '../lib/scoring'

/** Hand of five distinct tiles; 3m and 6p are the waits. */
const HAND = ['1m', '3m', '5p', '6p', '9s']
const WAITS = ['3m', '6p']

describe('safe-tile scoring', () => {
  it('gives full marks for every safe tile and nothing else', () => {
    const s = scoreSafeGuess(['1m', '5p', '9s'], WAITS, HAND)
    expect(s.exact).toBe(true)
    expect(s.points).toBe(100)
    expect(s.falsePositives).toEqual([])
  })

  it('scores zero the moment a wait tile is called safe', () => {
    // Two genuinely safe tiles, but 3m deals in.
    const s = scoreSafeGuess(['1m', '5p', '3m'], WAITS, HAND)
    expect(s.points).toBe(0)
    expect(s.exact).toBe(false)
    expect(s.falsePositives).toEqual(['3m'])
  })

  it('gives partial credit for a cautious but incomplete answer', () => {
    const s = scoreSafeGuess(['1m'], WAITS, HAND)
    expect(s.points).toBeGreaterThan(0)
    expect(s.points).toBeLessThan(100)
    expect(s.missed.sort()).toEqual(['5p', '9s'])
  })

  it('treats a red five as its plain counterpart', () => {
    const s = scoreSafeGuess(['5p'], ['3m'], ['5pr', '3m'])
    expect(s.falsePositives).toEqual([])
    expect(s.hits).toEqual(['5p'])
  })

  it('never rewards an empty answer', () => {
    expect(scoreSafeGuess([], WAITS, HAND).exact).toBe(false)
  })
})

describe('a hand that cannot deal in', () => {
  // Keishiki tenpai: the shape is tenpai but holds no yaku, so no tile in it
  // can be ronned and the whole hand is safe to cut from.
  const NO_RON: string[] = []

  it('treats every tile as safe when nothing can be ronned', () => {
    const s = scoreSafeGuess(HAND, NO_RON, HAND)
    expect(s.exact).toBe(true)
    expect(s.points).toBe(100)
    expect(s.missed).toEqual([])
  })

  it('cannot deal in, so a tile that completes the shape is not punished', () => {
    const s = scoreSafeGuess(['3m'], NO_RON, HAND)
    expect(s.falsePositives).toEqual([])
    expect(s.points).toBeGreaterThan(0)
  })

  it('still marks a cautious partial answer short of full marks', () => {
    const s = scoreSafeGuess(['1m'], NO_RON, HAND)
    expect(s.exact).toBe(false)
    expect(s.points).toBeLessThan(100)
  })
})
