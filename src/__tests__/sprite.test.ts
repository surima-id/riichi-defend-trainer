import { describe, expect, it } from 'vitest'
import { SPRITE_COUNT, SPRITE_ORDER, spriteIndex } from '../lib/sprite'

describe('sprite', () => {
  it('has 34 base tiles plus 3 red fives', () => {
    expect(SPRITE_COUNT).toBe(37)
    expect(new Set(SPRITE_ORDER).size).toBe(37)
  })

  it('matches the column order emitted by build_sprite.py', () => {
    expect(SPRITE_ORDER[0]).toBe('1m')
    expect(SPRITE_ORDER[26]).toBe('9s')
    expect(SPRITE_ORDER[27]).toBe('E')
    // Haku sits between North and Hatsu; it is the blank-faced tile.
    expect(SPRITE_ORDER[31]).toBe('P')
    expect(SPRITE_ORDER[33]).toBe('C')
    expect(SPRITE_ORDER.slice(34)).toEqual(['5mr', '5pr', '5sr'])
  })

  it('gives red fives their own column', () => {
    expect(spriteIndex('5mr')).not.toBe(spriteIndex('5m'))
    expect(spriteIndex('5mr')).toBe(34)
  })

  it('falls back to the plain tile for unknown suffixes', () => {
    expect(spriteIndex('5m')).toBe(4)
    expect(spriteIndex('E')).toBe(27)
  })
})
