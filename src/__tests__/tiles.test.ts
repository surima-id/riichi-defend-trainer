import { describe, expect, it } from 'vitest'
import { ALL_TILES, doraFromMarker, normalize, sortTiles } from '../lib/tiles'

describe('tiles', () => {
  it('has 34 distinct tile kinds', () => {
    expect(ALL_TILES).toHaveLength(34)
    expect(new Set(ALL_TILES).size).toBe(34)
  })

  it('normalises red fives', () => {
    expect(normalize('5mr')).toBe('5m')
    expect(normalize('5m')).toBe('5m')
    expect(normalize('E')).toBe('E')
  })

  it('sorts man, pin, sou then honors', () => {
    expect(sortTiles(['C', '3s', '1m', '5p'])).toEqual(['1m', '5p', '3s', 'C'])
  })

  it('wraps dora indicators', () => {
    expect(doraFromMarker('8m')).toBe('9m')
    expect(doraFromMarker('9s')).toBe('1s')
    expect(doraFromMarker('N')).toBe('E')
    expect(doraFromMarker('C')).toBe('P')
    expect(doraFromMarker('5pr')).toBe('6p')
  })
})
