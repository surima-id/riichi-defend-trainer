import { useCallback, useEffect, useMemo, useState } from 'react'
import { HandReplay } from './components/HandReplay'
import { Table } from './components/Table'
import { Tile } from './components/Tile'
import { TileSelector } from './components/TileSelector'
import {
  DEAL_IN_PENALTY, scoreGuess, scoreSafeGuess, type Mode, type Score,
} from './lib/scoring'
import { normalize, sortTiles } from './lib/tiles'
import { unpackAll, type PackedPuzzle } from './lib/unpack'
import type { Pai, Puzzle } from './lib/types'

type Filter = 'all' | 'riichi' | 'open'

/**
 * Earliest riichi turn kept by default.
 *
 * A riichi on turn 3 leaves almost no river to read, so the answer comes down
 * to guessing rather than reading. Ten discards in, the hand has shown enough
 * tedashi to reason from.
 */
const MIN_RIICHI_TURN = 10

/**
 * Fewest calls an open hand needs to be worth reading.
 *
 * One call barely constrains the hand; two exposed sets plus the river narrow
 * it enough that the wait is genuinely inferable.
 */
const MIN_OPEN_MELDS = 2

/**
 * Tiles the viewer could actually discard, de-duplicated.
 *
 * Safe-tile reading asks which of *your own* tiles you could cut, so the
 * candidates are your hand rather than all 34 tiles. Red fives collapse onto
 * their plain counterpart, since safety is a property of the tile's face.
 */
function discardable(p: Puzzle): Pai[] {
  const self = p.others.find((o) => o.seat === (p.target.seat + 2) % 4)
  return [...new Set((self?.hand ?? []).map(normalize))]
}

/**
 * The tiles that would actually deal in if cut.
 *
 * Not every wait is a deal-in: a hand with no yaku cannot claim a discard, so
 * its waits complete the shape without anyone being able to ron them. This is
 * `ronAnswer` rather than `answer` throughout safe mode -- for a keishiki
 * tenpai hand the honest answer is that the whole hand is safe.
 */
function dangerous(p: Puzzle): Set<Pai> {
  return new Set(p.ronAnswer.map(normalize))
}

/**
 * Safe-tile reading needs a hand with at least one tile that can be cut.
 *
 * Hands holding nothing dangerous are kept deliberately. "Everything in my
 * hand passes" is a real and common read, and filtering those positions out
 * would train the opposite reflex -- that a dangerous tile is always in there
 * somewhere, so one must be found. The only hands excluded are the degenerate
 * ones where every tile deals in and there is no safe answer to give.
 */
function hasSafeChoice(p: Puzzle): boolean {
  const waits = dangerous(p)
  return discardable(p).some((t) => !waits.has(t))
}

/** The tiles in hand that are genuinely safe to cut — the answer in safe mode. */
function safeTiles(p: Puzzle): Pai[] {
  const waits = dangerous(p)
  return discardable(p).filter((t) => !waits.has(t))
}

/** A tenpai hand that cannot ron at all: every tile in hand is safe. */
function isYakuless(p: Puzzle): boolean {
  return p.ronAnswer.length === 0
}

/** Does this puzzle have enough information to be read rather than guessed? */
function isSubstantial(p: Puzzle): boolean {
  return p.kind === 'riichi'
    ? (p.target.riichiTurn ?? 0) >= MIN_RIICHI_TURN
    : p.target.melds.length >= MIN_OPEN_MELDS
}

interface Stats {
  answered: number
  exact: number
  points: number
  streak: number
  bestStreak: number
}

const EMPTY_STATS: Stats = {
  answered: 0, exact: 0, points: 0, streak: 0, bestStreak: 0,
}

export default function App() {
  const [pool, setPool] = useState<Puzzle[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('waits')
  const [filter, setFilter] = useState<Filter>('all')
  // On by default: most hands in the corpus are technically readable but too
  // thin to reason about. Opt out to drill the full pool, early riichi included.
  const [substantialOnly, setSubstantialOnly] = useState(true)
  const [order, setOrder] = useState<number[]>([])
  const [cursor, setCursor] = useState(0)
  const [selected, setSelected] = useState<Pai[]>([])
  const [result, setResult] = useState<Score | null>(null)
  // Set when the answer was shown without a guess. Kept separate from `result`
  // so a revealed hand never reaches the scoreboard: the stats are meant to
  // track how well you read, and a hand you gave up on says nothing about that.
  const [revealed, setRevealed] = useState(false)
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)

  useEffect(() => {
    fetch('/puzzles.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: PackedPuzzle[]) => setPool(unpackAll(d)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const filtered = useMemo(() => {
    if (!pool) return []
    let byKind = filter === 'all' ? pool : pool.filter((p) => p.kind === filter)
    if (mode === 'safe') byKind = byKind.filter(hasSafeChoice)
    if (!substantialOnly) return byKind
    const kept = byKind.filter(isSubstantial)
    // Never hand back an empty drill: if the thresholds rule out everything in
    // this category, the unfiltered set is more useful than a blank screen.
    return kept.length > 0 ? kept : byKind
  }, [pool, filter, mode, substantialOnly])

  // Reshuffle whenever the filter changes so a session does not repeat.
  useEffect(() => {
    if (filtered.length === 0) return
    const idx = filtered.map((_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    setOrder(idx)
    setCursor(0)
    setSelected([])
    setResult(null)
    setRevealed(false)
  }, [filtered])

  // Switching the question invalidates any selection made for the old one.
  useEffect(() => {
    setSelected([])
    setResult(null)
    setRevealed(false)
  }, [mode])

  const puzzle = filtered.length > 0 && order.length > 0
    ? filtered[order[cursor % order.length]]
    : null

  const submit = useCallback(() => {
    if (!puzzle || result || revealed || selected.length === 0) return
    const s =
      mode === 'safe'
        ? scoreSafeGuess(selected, puzzle.ronAnswer, discardable(puzzle))
        : scoreGuess(selected, puzzle.answer)
    setResult(s)
    setStats((prev) => {
      const streak = s.exact ? prev.streak + 1 : 0
      return {
        answered: prev.answered + 1,
        exact: prev.exact + (s.exact ? 1 : 0),
        points: prev.points + s.points,
        streak,
        bestStreak: Math.max(prev.bestStreak, streak),
      }
    })
  }, [puzzle, result, revealed, selected, mode])

  const resetStats = useCallback(() => {
    setStats(EMPTY_STATS)
  }, [])

  const reveal = useCallback(() => {
    if (!puzzle || result || revealed) return
    setRevealed(true)
  }, [puzzle, result, revealed])

  const next = useCallback(() => {
    setCursor((c) => c + 1)
    setSelected([])
    setResult(null)
    setRevealed(false)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (result || revealed) next()
        else submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [result, revealed, next, submit])

  const toggle = (pai: Pai) =>
    setSelected((s) => (s.includes(pai) ? s.filter((t) => t !== pai) : [...s, pai]))

  if (error) {
    return (
      <Shell>
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">Could not load puzzles.</p>
          <p className="mt-1">{error}</p>
          <p className="mt-2 text-rose-700">
            Run <code className="rounded bg-rose-100 px-1">python tools/build_web_data.py</code>{' '}
            to generate <code>public/puzzles.json</code>.
          </p>
        </div>
      </Shell>
    )
  }

  if (!pool || !puzzle) {
    return (
      <Shell>
        <p className="text-sm text-white/50">Loading puzzles…</p>
      </Shell>
    )
  }

  const t = puzzle.target
  const accuracy = stats.answered ? Math.round((stats.exact / stats.answered) * 100) : 0

  return (
    <Shell>
      <div className="mb-3 flex gap-1 rounded-lg border border-white/10 bg-felt-800/80 p-1 text-sm">
        {([
          ['waits', 'Wait Reading', 'Name every tile that completes their hand.'],
          ['safe', 'Safe Tile Reading', 'Name the tiles in your hand you could cut without dealing in.'],
        ] as [Mode, string, string][]).map(([m, label, hint]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            title={hint}
            className={[
              'rounded-md px-3 py-1.5 font-medium transition',
              mode === m
                ? 'bg-gold-400 text-felt-950'
                : 'text-white/60 hover:bg-white/10',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-white/10 bg-felt-800/80 p-1">
          {(['all', 'riichi', 'open'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={[
                'rounded-md px-3 py-1 text-xs font-medium capitalize transition',
                filter === f
                  ? 'bg-gold-400 text-felt-950'
                  : 'text-white/60 hover:bg-white/10',
              ].join(' ')}
            >
              {f === 'all' ? 'All' : f === 'riichi' ? 'Riichi' : 'Open hands'}
            </button>
          ))}
        </div>

        <label
          className="flex cursor-pointer items-center gap-2 text-xs text-white/60 transition hover:text-white/85"
          title={`Keep only riichi declared on turn ${MIN_RIICHI_TURN} or later, and open hands with at least ${MIN_OPEN_MELDS} calls. Turn this off to drill every hand.`}
        >
          <input
            type="checkbox"
            checked={substantialOnly}
            onChange={(e) => setSubstantialOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-gold-400"
          />
          Readable hands only
        </label>

        <div className="flex items-center gap-4">
          <dl className="flex gap-5 text-sm text-white/70">
            <Stat label="Solved" value={`${stats.exact}/${stats.answered}`} />
            <Stat label="Exact" value={`${accuracy}%`} />
            <Stat label="Points" value={String(stats.points)} />
            <Stat label="Streak" value={`${stats.streak} (best ${stats.bestStreak})`} />
          </dl>
          {stats.answered > 0 && (
            <button
              type="button"
              onClick={resetStats}
              title="Clear the scoreboard and start a fresh session. The current hand is kept."
              className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-white/50 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              Reset score
            </button>
          )}
        </div>
      </div>

      <p className="mb-3 text-sm text-white/65">
        Read the <b className="text-gold-300">highlighted seat</b> across the
        table
        {t.riichi ? ' — they have declared riichi.' : ' — they have an open tenpai hand.'}
        {mode === 'safe' && ' Which of your tiles can you cut without dealing in?'}
      </p>

      <Table puzzle={puzzle} />

      <div className="mt-4 rounded-xl border border-white/10 bg-felt-800/80 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">
            {result || revealed
              ? 'Answer'
              : mode === 'safe'
                ? 'Select every tile you could discard safely'
                : 'Select every tile you think completes the hand'}
          </h3>
          {!result && !revealed && selected.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-sm text-white/50 underline hover:text-white"
            >
              clear
            </button>
          )}
        </div>

        <TileSelector
          selected={selected}
          onToggle={toggle}
          disabled={Boolean(result) || revealed}
          only={mode === 'safe' ? sortTiles(discardable(puzzle)) : null}
          reveal={
            result || revealed
              ? { answer: mode === 'safe' ? safeTiles(puzzle) : puzzle.answer }
              : null
          }
        />

        {result && (
          <div
            className={[
              'mt-4 rounded-lg border p-3 text-sm',
              result.exact
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                : mode === 'safe' && result.falsePositives.length > 0
                  ? 'border-rose-400/40 bg-rose-500/15 text-rose-100'
                  : 'border-gold-400/40 bg-gold-400/10 text-gold-300',
            ].join(' ')}
          >
            <div className="flex flex-wrap items-center gap-2">
              <b>
                {result.exact
                  ? 'Exact!'
                  : mode === 'safe' && result.falsePositives.length > 0
                    ? 'Dealt in.'
                    : 'Not quite.'}
              </b>
              <span>
                {result.points >= 0 ? '+' : ''}
                {result.points} pts
              </span>
              {/* Say what the score was built from in the drill's own terms.
                  "5 of 8 safe tiles" is something a player can act on; the F1
                  this used to print is not. */}
              <span className="text-xs opacity-75">
                {mode === 'safe'
                  ? `${result.hits.length} of ${result.hits.length + result.missed.length} safe tiles`
                  : `${result.hits.length} of ${result.hits.length + result.missed.length} waits`}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs">
                {mode === 'safe' ? 'Safe to cut:' : 'True wait:'}
              </span>
              {sortTiles(mode === 'safe' ? safeTiles(puzzle) : puzzle.answer).map((p, i) => (
                <Tile key={i} pai={p} size="sm" />
              ))}
            </div>
            {mode === 'safe' && isYakuless(puzzle) && (
              <p className="mt-1 text-xs opacity-90">
                This hand has no yaku, so it cannot ron —{' '}
                {puzzle.answer.length > 0
                  ? `${sortTiles(puzzle.answer).join(' ')} completes the shape but nobody can deal in.`
                  : 'nothing completes it for a ron.'}{' '}
                Keishiki tenpai: called for the noten payments at a draw. Every
                tile in your hand is safe.
              </p>
            )}
            {result.missed.length > 0 && (
              <p className="mt-1 text-xs">
                Missed: {sortTiles(result.missed).join(' ')}
              </p>
            )}
            {result.falsePositives.length > 0 && (
              <p className="mt-1 text-xs">
                {mode === 'safe' ? 'Deals in: ' : 'Not waits: '}
                {sortTiles(result.falsePositives).join(' ')}
                {mode === 'safe' && (
                  <>
                    {' '}
                    — {result.falsePositives.length > 1
                      ? `${result.falsePositives.length} × −${DEAL_IN_PENALTY}`
                      : `−${DEAL_IN_PENALTY}`}{' '}
                    pts
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {revealed && (
          <div className="mt-4 rounded-lg border border-sky-400/40 bg-sky-500/10 p-3 text-sm text-sky-100">
            <div className="flex flex-wrap items-center gap-2">
              <b>Answer shown.</b>
              <span className="text-xs opacity-75">Not scored</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs">
                {mode === 'safe' ? 'Safe to cut:' : 'True wait:'}
              </span>
              {sortTiles(mode === 'safe' ? safeTiles(puzzle) : puzzle.answer).map((p, i) => (
                <Tile key={i} pai={p} size="sm" />
              ))}
            </div>
            {mode === 'safe' && isYakuless(puzzle) && (
              <p className="mt-1 text-xs opacity-90">
                This hand has no yaku, so it cannot ron —{' '}
                {puzzle.answer.length > 0
                  ? `${sortTiles(puzzle.answer).join(' ')} completes the shape but nobody can deal in.`
                  : 'nothing completes it for a ron.'}{' '}
                Keishiki tenpai: called for the noten payments at a draw. Every
                tile in your hand is safe.
              </p>
            )}
          </div>
        )}

        {(result || revealed) && (
          <HandReplay
            history={puzzle.history}
            melds={t.melds}
            turn={puzzle.turn}
          />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {result || revealed ? (
            <button
              type="button"
              onClick={next}
              className="rounded-lg bg-gold-400 px-5 py-2.5 text-base font-semibold text-felt-950 transition hover:bg-gold-300"
            >
              Next hand ⏎
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={submit}
                disabled={selected.length === 0}
                className="rounded-lg bg-gold-400 px-5 py-2.5 text-base font-semibold text-felt-950 transition hover:bg-gold-300 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40"
              >
                Submit guess ⏎
              </button>
              <button
                type="button"
                onClick={reveal}
                title="Reveal the wait without guessing. This hand will not be scored."
                className="rounded-lg border border-white/20 px-4 py-2.5 text-base font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Show answer
              </button>
            </>
          )}
          <span className="text-sm text-white/50">
            {result || revealed ? '' : `${selected.length} selected`}
          </span>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-white/45">
        A <b className="text-gold-300">gold ring</b> marks the tile just
        discarded — the cut that poses this puzzle. <b>Bright</b> tiles with a{' '}
        <b className="text-sky-300">blue bar</b> were tedashi — they came out of
        the hand, so the shape changed. <b>Greyed</b>, unmarked tiles were
        tsumogiri (cut straight from the draw), which say nothing about the
        hand. A <b className="text-rose-500">red outline</b> marks an akadora
        five. A sideways tile is the riichi declaration, and the white{' '}
        <b>tenbou stick</b> in front of a pond means that seat has declared. A{' '}
        <b className="text-amber-500">wind badge</b> (東/南/西/北) marks a tile
        called away, naming the seat that took it. Positions are real Tenhou
        Houou games; waits are computed from the hand the log records.
      </p>
    </Shell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <dt className="text-[11px] uppercase tracking-wide text-white/40">{label}</dt>
      <dd className="font-semibold text-white">{value}</dd>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-white">
        SURIMA Riichi Defend Trainer
      </h1>
      <p className="mb-4 text-sm text-white/55">
        Read the river. Guess the wait. Repeat.
      </p>
      {children}

      <footer className="mt-8 border-t border-white/10 pt-4 text-sm text-white/45">
        <a
          href="https://surima.id"
          target="_blank"
          rel="noreferrer"
          className="text-gold-300/80 underline underline-offset-2 transition hover:text-gold-300"
        >
          surima.id
        </a>
      </footer>
    </main>
  )
}
