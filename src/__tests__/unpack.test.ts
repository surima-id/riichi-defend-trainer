import { describe, expect, it } from 'vitest'
import { unpackPuzzle, unpackRiverTile, type PackedPuzzle } from '../lib/unpack'

describe('unpackRiverTile', () => {
  it('treats a bare token as tsumogiri', () => {
    expect(unpackRiverTile('4s')).toEqual({
      pai: '4s', tsumogiri: true, riichi: false, called: false,
    })
  })

  it('reads the tedashi flag', () => {
    const t = unpackRiverTile('-4s')
    expect(t.tsumogiri).toBe(false)
    expect(t.pai).toBe('4s')
  })

  it('reads combined flags in any order', () => {
    const t = unpackRiverTile('-*!4s')
    expect(t).toEqual({ pai: '4s', tsumogiri: false, riichi: true, called: true })
  })

  it('preserves red fives and honors', () => {
    expect(unpackRiverTile('-5mr').pai).toBe('5mr')
    expect(unpackRiverTile('*E').pai).toBe('E')
  })
})

describe('unpackPuzzle', () => {
  const packed: PackedPuzzle = {
    t: { s: 2, r: ['1m', '-9p', '*-3s'], m: [['p', 1, 0, '4s', '4s', '4s']], q: 1 },
    o: [{ s: 0, r: ['E'] }, { s: 1, r: [] }, { s: 3, r: ['-2p'] }],
    b: 'E', k: 1, h: 0, d: ['8m'], y: 0, a: ['2m', '5m'], n: 1, u: 3,
  }

  it('restores the target seat and wait', () => {
    const p = unpackPuzzle(packed, 0)
    expect(p.kind).toBe('riichi')
    expect(p.answer).toEqual(['2m', '5m'])
    expect(p.target.seat).toBe(2)
    expect(p.target.river).toHaveLength(3)
    expect(p.target.melds[0].type).toBe('pon')
    expect(p.target.melds[0].tiles).toEqual(['4s', '4s', '4s'])
  })

  it('derives the riichi turn from the declaration tile', () => {
    expect(unpackPuzzle(packed, 0).target.riichiTurn).toBe(3)
  })

  it('computes seat wind relative to the dealer', () => {
    expect(unpackPuzzle(packed, 0).target.seatWind).toBe('W')
  })

  it('restores which seat the called tile came from', () => {
    // The called tile is drawn sideways and its position encodes the source
    // seat, so losing these two fields silently makes every meld look
    // self-drawn.
    const m = unpackPuzzle(packed, 0).target.melds[0]
    expect(m.fromOffset).toBe(1)
    expect(m.takenIndex).toBe(0)
  })

  it('keeps all three opponents', () => {
    expect(unpackPuzzle(packed, 0).others).toHaveLength(3)
  })
})
