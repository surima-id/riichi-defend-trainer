import { sortTiles } from './tiles'
import type {
  HistoryStep, Meld, Pai, Puzzle, RiverTile, Seat, TargetSeat,
} from './types'

/** Wire format written by tools/build_web_data.py. */
interface PackedSeat {
  s: number
  r: string[]
  m?: [string, number, number, ...Pai[]][]
  q?: 1
  h?: Pai[]         // concealed hand, observer's seat only
}

interface PackedStep {
  d: Pai            // discard
  g?: 1             // tsumogiri
  t?: Pai           // drawn tile
  h?: Pai[]         // full hand (first step only)
  i?: Pai[]         // tiles added since the previous step
  o?: Pai[]         // tiles removed since the previous step
  w?: Pai[]         // waits, present only when they changed
}

export interface PackedPuzzle {
  t: PackedSeat
  o: PackedSeat[]
  b: string
  k: number
  h: number
  d: Pai[]
  y: number
  c?: number[]
  a: Pai[]
  x?: Pai[]         // ron-able waits, absent when identical to `a`
  n: 0 | 1
  u: number
  z?: PackedStep[]
}

/**
 * Rebuild the turn-by-turn hand from the packed deltas.
 *
 * Only the first step carries a full hand; later steps say which tiles entered
 * and left, and waits repeat implicitly until they change.
 */
function unpackHistory(steps: PackedStep[] | undefined): HistoryStep[] {
  if (!steps) return []
  const out: HistoryStep[] = []
  let hand: Pai[] = []
  let waits: Pai[] = []

  for (const s of steps) {
    if (s.h) {
      hand = [...s.h]
    } else if (s.i || s.o) {
      const next = [...hand]
      for (const t of s.o ?? []) {
        const k = next.indexOf(t)
        if (k >= 0) next.splice(k, 1)
      }
      next.push(...(s.i ?? []))
      hand = sortTiles(next)
    }
    if (s.w) waits = s.w
    out.push({
      draw: s.t ?? null,
      discard: s.d,
      tsumogiri: s.g === 1,
      hand: [...hand],
      waits: [...waits],
    })
  }
  return out
}

const MELD_TYPE: Record<string, Meld['type']> = {
  p: 'pon', c: 'chi', d: 'daiminkan', a: 'ankan', k: 'kakan',
}

/** Parse a packed river token: flags '-' tedashi, '*' riichi, '!' called. */
export function unpackRiverTile(token: string): RiverTile {
  let i = 0
  let tedashi = false
  let riichi = false
  let called = false
  while (i < token.length) {
    const c = token[i]
    if (c === '-') tedashi = true
    else if (c === '*') riichi = true
    else if (c === '!') called = true
    else break
    i++
  }
  return { pai: token.slice(i), tsumogiri: !tedashi, riichi, called }
}

function unpackMelds(m: PackedSeat['m']): Meld[] {
  if (!m) return []
  return m.map(([type, fromOffset, takenIndex, ...tiles]) => ({
    type: MELD_TYPE[type] ?? 'pon',
    tiles,
    fromOffset,
    takenIndex,
  }))
}

function unpackSeat(p: PackedSeat): Seat {
  return {
    seat: p.s,
    river: p.r.map(unpackRiverTile),
    melds: unpackMelds(p.m),
    riichi: p.q === 1,
    ...(p.h ? { hand: sortTiles(p.h) } : {}),
  }
}

export function unpackPuzzle(p: PackedPuzzle, index: number): Puzzle {
  const target = unpackSeat(p.t)
  const riichiIdx = target.river.findIndex((t) => t.riichi)
  const targetSeat: TargetSeat = {
    ...target,
    riichiTurn: riichiIdx >= 0 ? riichiIdx + 1 : null,
    seatWind: ['E', 'S', 'W', 'N'][(target.seat - p.y + 4) % 4],
  }
  return {
    target: targetSeat,
    others: p.o.map(unpackSeat),
    round: {
      bakaze: p.b,
      kyoku: p.k,
      honba: p.h,
      doraMarkers: p.d,
      scores: p.c ?? [],
      oya: p.y,
    },
    answer: p.a,
    ronAnswer: p.x ?? p.a,
    kind: p.n === 1 ? 'riichi' : 'open',
    turn: p.u,
    gameId: String(index),
    history: unpackHistory(p.z),
  }
}

export function unpackAll(rows: PackedPuzzle[]): Puzzle[] {
  return rows.map(unpackPuzzle)
}
