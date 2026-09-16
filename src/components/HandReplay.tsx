import { useState } from 'react'
import { Tile } from './Tile'
import { sortTiles } from '../lib/tiles'
import type { HistoryStep, Meld, Pai } from '../lib/types'

interface HandReplayProps {
  history: HistoryStep[]
  melds: Meld[]
  /** Turn the puzzle was posed at; the replay opens here. */
  turn: number
}

/**
 * Turn-by-turn replay of how the target's hand actually developed.
 *
 * Shown only after the answer is submitted. The river tells you *that* the
 * hand changed; this shows *how*, which is what turns a wrong guess into a
 * lesson — in particular, the turn the hand first reached tenpai and what it
 * was waiting on before that.
 *
 * Melds are only shown once they exist. The stored melds are the hand's *final*
 * state, so drawing all of them on every turn would claim the player had
 * already called on turn 1. A concealed hand holds 13 - 3n tiles for n melds,
 * so each step's own hand length says how many calls had been made by then.
 */
export function HandReplay({ history, melds, turn }: HandReplayProps) {
  const last = Math.max(0, history.length - 1)
  const [at, setAt] = useState(Math.min(turn - 1, last))

  if (history.length === 0) return null

  const step = history[Math.min(at, last)]
  const firstTenpai = history.findIndex((h) => h.waits.length > 0)

  // Calls are appended in the order they were made, so the melds that existed
  // at this point are the first n of them.
  const meldsAt = melds.slice(0, Math.max(0, Math.round((13 - step.hand.length) / 3)))

  // The hand as it stood with the discard still in it. Only the post-discard
  // hand is stored, so put the cut tile back to recover the choice the player
  // was actually looking at. On a drawn turn that is the 14th tile; after a
  // call there is no draw and the hand is simply one longer.
  const held = sortTiles([...step.hand, step.discard])

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-felt-900/60 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-semibold text-white">
          How the hand developed
        </h4>
        <span className="text-sm text-white/55">
          {firstTenpai >= 0
            ? `Reached tenpai on turn ${firstTenpai + 1}`
            : 'Never reached tenpai'}
        </span>
      </div>

      {/* Turn scrubber: one pip per discard, tenpai turns marked. */}
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {history.map((h, i) => {
          const active = i === Math.min(at, last)
          const tenpai = h.waits.length > 0
          return (
            <button
              key={i}
              type="button"
              onClick={() => setAt(i)}
              title={`Turn ${i + 1}${tenpai ? ' — tenpai' : ''}`}
              className={[
                'h-8 w-8 rounded text-xs font-medium transition',
                active
                  ? 'bg-gold-400 text-felt-950'
                  : tenpai
                    ? 'bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/40'
                    : 'bg-white/10 text-white/50 hover:bg-white/20',
              ].join(' ')}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        <HandRow
          label={
            step.draw
              ? 'Before the cut — holding the draw'
              : 'Before the cut — after the call'
          }
          hand={held}
          melds={meldsAt}
          drawn={step.draw}
          discard={step.discard}
          tsumogiri={step.tsumogiri}
        />
        <HandRow
          label={`After turn ${Math.min(at, last) + 1}`}
          hand={sortTiles(step.hand)}
          melds={meldsAt}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <span className="text-[11px] uppercase tracking-wide text-white/40">
          Waiting on
        </span>
        {step.waits.length === 0 ? (
          <span className="text-sm text-white/55">not tenpai yet</span>
        ) : (
          sortTiles(step.waits).map((p, i) => <Tile key={i} pai={p} size="md" />)
        )}
      </div>
    </div>
  )
}

/**
 * One row of the replay: a concealed hand, its melds, and — on the "before"
 * row — which tile is about to leave.
 *
 * The discard is drawn in place rather than off to the side, because the point
 * of the row is to show the choice as the player saw it: fourteen tiles, one of
 * which is going. A drawn tile is split off to the right the way a real client
 * holds it, so a tsumogiri reads as "cut the one just drawn" at a glance.
 */
function HandRow({
  label,
  hand,
  melds,
  drawn = null,
  discard,
  tsumogiri = false,
}: {
  label: string
  hand: Pai[]
  melds: Meld[]
  drawn?: Pai | null
  discard?: Pai
  tsumogiri?: boolean
}) {
  // The drawn tile sits apart from the sorted hand, so remove one copy of it
  // from the run rather than drawing it twice.
  const main = [...hand]
  if (drawn) {
    const k = main.indexOf(drawn)
    if (k >= 0) main.splice(k, 1)
  }

  // Mark the tile leaving this turn. A tsumogiri leaves from the drawn slot,
  // so the in-hand run carries no mark.
  let cutAt = -1
  if (discard && !tsumogiri) cutAt = main.indexOf(discard)

  return (
    <div>
      <p className="mb-1 text-[11px] uppercase tracking-wide text-white/40">
        {label}
      </p>
      <div className="flex flex-wrap items-end gap-px">
        {main.map((p, i) => (
          <Tile
            key={i}
            pai={p}
            size="md"
            className={i === cutAt ? 'outline outline-2 outline-offset-1 outline-rose-400' : ''}
            title={i === cutAt ? `${p} — cut this turn (tedashi)` : undefined}
          />
        ))}

        {drawn && (
          <span className="ml-2 flex items-end">
            <Tile
              pai={drawn}
              size="md"
              className={
                tsumogiri ? 'outline outline-2 outline-offset-1 outline-rose-400' : ''
              }
              title={
                tsumogiri ? `${drawn} — drawn and cut (tsumogiri)` : `${drawn} — drawn`
              }
            />
          </span>
        )}

        {melds.map((m, i) => (
          <div key={i} className="ml-2 flex items-end gap-px" title={m.type}>
            {m.tiles.map((t, j) => (
              <Tile
                key={j}
                pai={t}
                size="md"
                facedown={m.type === 'ankan' && (j === 0 || j === 3)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
