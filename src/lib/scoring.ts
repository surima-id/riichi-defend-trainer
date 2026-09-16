import { normalize } from './tiles'
import type { Pai } from './types'

/** Which question is being asked of the player. */
export type Mode = 'waits' | 'safe'

export interface Score {
  /** Correctly selected wait tiles. */
  hits: Pai[]
  /** Selected tiles that are not waits. */
  falsePositives: Pai[]
  /** Wait tiles the player failed to select. */
  missed: Pai[]
  /** Every wait found and nothing extra. */
  exact: boolean
  /** Harmonic mean of precision and recall, 0..1. */
  f1: number
  /** Points awarded for this question, 0..100. */
  points: number
}

/**
 * Grade a guess against the true wait set.
 *
 * Binary right/wrong would punish a three-sided wait the same as a tanki, so
 * we grade on set overlap: partial credit via F1, with a bonus for an exact
 * match. Red fives are normalised — guessing '5m' covers '5mr'.
 */
export function scoreGuess(selected: Pai[], answer: Pai[]): Score {
  const sel = new Set(selected.map(normalize))
  const ans = new Set(answer.map(normalize))

  const hits = [...sel].filter((t) => ans.has(t))
  const falsePositives = [...sel].filter((t) => !ans.has(t))
  const missed = [...ans].filter((t) => !sel.has(t))

  const precision = sel.size === 0 ? 0 : hits.length / sel.size
  const recall = ans.size === 0 ? 0 : hits.length / ans.size
  const f1 =
    precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)

  const exact = missed.length === 0 && falsePositives.length === 0 && ans.size > 0
  const points = exact ? 100 : Math.round(f1 * 80)

  return { hits, falsePositives, missed, exact, f1, points }
}


/**
 * Grade a safe-tile guess: which tiles could be discarded without dealing in.
 *
 * The same underlying fact as the wait drill read from the other side, but it
 * cannot reuse the same grading. Waits are a handful of tiles out of 34, so
 * their complement is almost everything — scoring safety by overlap would hand
 * out most of the marks for selecting tiles at random.
 *
 * What matters instead is asymmetric. Passing over a safe tile costs a little
 * tempo; naming a wait tile safe deals in. So a single deal-in drops the score
 * to zero however many correct tiles were picked alongside it, and the rest of
 * the score is the share of genuinely safe tiles found.
 */
export function scoreSafeGuess(selected: Pai[], answer: Pai[], candidates: Pai[]): Score {
  const sel = new Set(selected.map(normalize))
  const waits = new Set(answer.map(normalize))
  const safe = new Set(candidates.map(normalize).filter((t) => !waits.has(t)))

  const hits = [...sel].filter((t) => safe.has(t))
  // Selected tiles that are actually waits: these are the deal-ins.
  const falsePositives = [...sel].filter((t) => waits.has(t))
  const missed = [...safe].filter((t) => !sel.has(t))

  const recall = safe.size === 0 ? 0 : hits.length / safe.size
  const precision = sel.size === 0 ? 0 : hits.length / sel.size
  const f1 =
    precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)

  // Dealing in is the whole failure condition, so it is not scored on a curve.
  const dealtIn = falsePositives.length > 0
  const exact = !dealtIn && missed.length === 0 && sel.size > 0
  const points = dealtIn ? 0 : exact ? 100 : Math.round(recall * 80)

  return { hits, falsePositives, missed, exact, f1, points }
}
