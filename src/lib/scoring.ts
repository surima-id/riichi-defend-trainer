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
  /**
   * Share of the correct tiles that were found, 0..1.
   *
   * The number the safe-tile score is built on, kept separate from `f1` so the
   * result can be explained in plain terms: "you covered 5 of the 8 safe
   * tiles" is something a player can act on; an F1 of 0.88 is not.
   */
  coverage: number
  /** Points awarded for this question. Negative after a deal-in. */
  points: number
}

/**
 * Points lost per wait tile called safe.
 *
 * Set above the 100 a perfect read can earn, so a deal-in can never be
 * outweighed by the safe tiles found alongside it -- at the table the hand is
 * simply over. It is a penalty rather than a zero so that guessing widely and
 * hoping stays worse than passing on the tiles you cannot read.
 */
export const DEAL_IN_PENALTY = 120

/**
 * Most tiles a wait guess may name.
 *
 * A wait is at most a handful of tiles, so an answer wider than this has
 * stopped being a read. The cap is enforced at the input as well as here: a
 * player who cannot select a tenth tile learns the boundary by feel, rather
 * than by watching a score they cannot explain drop towards nothing.
 */
export const MAX_WAIT_SELECTION = 9

/**
 * What a guess spread across the full nine tiles keeps of its credit.
 *
 * Not zero: casting a wide net over the right area is a weaker read than
 * naming the tile, but it is not the same as being wrong, and a player who
 * narrowed a hand to "somewhere in the low souzu" has learnt something worth
 * marking. Low enough that a precise answer is always worth several vague
 * ones.
 */
const BROADEST_CREDIT = 0.2

/**
 * How much of the coverage score a guess of this width keeps.
 *
 * Measured as tiles named beyond what the answer itself needs, so the taper
 * charges for vagueness rather than for the wait being wide: a three-sided
 * wait answered with three tiles is charged nothing, while a tanki answered
 * with three has spread itself over two tiles it did not need. From there the
 * credit falls linearly to BROADEST_CREDIT at the nine-tile cap.
 */
function breadthFactor(guessed: number, answerSize: number): number {
  const extra = Math.max(0, guessed - answerSize)
  const room = Math.max(1, MAX_WAIT_SELECTION - answerSize)
  const spread = Math.min(1, extra / room)
  return 1 - spread * (1 - BROADEST_CREDIT)
}

/**
 * Grade a guess against the true wait set.
 *
 * Binary right/wrong would punish a three-sided wait the same as a tanki, so
 * we grade on set overlap: partial credit with a bonus for an exact match. Red
 * fives are normalised — guessing '5m' covers '5mr'.
 *
 * Partial credit is coverage tapered by how widely the guess was cast, not F1.
 * F1 collapses fast enough that naming 1-2-3m with 3m the wait scored close to
 * nothing, which taught the wrong lesson: reading the wait down to a three-tile
 * neighbourhood is most of the work, and the river rarely narrows further than
 * that. Under the taper that guess keeps a clear majority of the marks, a
 * nine-tile scattergun keeps BROADEST_CREDIT of them, and only an exact answer
 * pays in full.
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
  // An exact read always pays in full, so no amount of tapering can make a
  // wider guess worth more than the right one.
  const points = exact
    ? 100
    : Math.round(recall * 80 * breadthFactor(sel.size, ans.size))

  return { hits, falsePositives, missed, exact, f1, coverage: recall, points }
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
 * tempo; naming a wait tile safe deals in. So the score is simply the share of
 * the safe tiles you found -- read two thirds of them and you score two thirds
 * -- and each tile that deals in subtracts a flat penalty large enough to sink
 * the whole hand below zero.
 *
 * A hand that cannot ron at all has no dangerous tile in it, so every tile in
 * hand counts as safe and nothing can be deducted.
 */
export function scoreSafeGuess(selected: Pai[], answer: Pai[], candidates: Pai[]): Score {
  const sel = new Set(selected.map(normalize))
  const waits = new Set(answer.map(normalize))
  const safe = new Set(candidates.map(normalize).filter((t) => !waits.has(t)))

  const hits = [...sel].filter((t) => safe.has(t))
  // Selected tiles that are actually waits: these are the deal-ins.
  const falsePositives = [...sel].filter((t) => waits.has(t))
  const missed = [...safe].filter((t) => !sel.has(t))

  const coverage = safe.size === 0 ? 0 : hits.length / safe.size
  const precision = sel.size === 0 ? 0 : hits.length / sel.size
  const f1 =
    precision + coverage === 0 ? 0 : (2 * precision * coverage) / (precision + coverage)

  const exact = falsePositives.length === 0 && missed.length === 0 && sel.size > 0
  // Straight coverage, so the score says what share of the danger you read.
  // The penalty is applied afterwards rather than folded in, so a deal-in
  // always costs the same whatever else was selected.
  const points =
    Math.round(coverage * 100) - falsePositives.length * DEAL_IN_PENALTY

  return { hits, falsePositives, missed, exact, f1, coverage, points }
}
