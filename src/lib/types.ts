export type Pai = string

export interface RiverTile {
  pai: Pai
  /** True when cut straight from the draw; false means it came from hand. */
  tsumogiri: boolean
  /** True on the riichi declaration tile. */
  riichi: boolean
  /** True when another player called this tile. */
  called: boolean
}

export interface Meld {
  type: 'pon' | 'chi' | 'daiminkan' | 'ankan' | 'kakan'
  tiles: Pai[]
  /** Seat the called tile came from, relative to the meld's owner:
   *  1 shimocha (right), 2 toimen (across), 3 kamicha (left), 0 self. */
  fromOffset: number
  /** Index into `tiles` of the called tile, or -1 for a concealed kan. */
  takenIndex: number
}

export interface Seat {
  seat: number
  river: RiverTile[]
  melds: Meld[]
  riichi: boolean
  /** Concealed hand, present only for the seat the viewer occupies. */
  hand?: Pai[]
}

export interface TargetSeat extends Seat {
  riichiTurn: number | null
  seatWind: string
}

export interface RoundInfo {
  bakaze: string
  kyoku: number
  honba: number
  doraMarkers: Pai[]
  scores: number[]
  oya: number
}

export interface HistoryStep {
  /** Tile drawn this turn, or null when the turn followed a call. */
  draw: Pai | null
  discard: Pai
  tsumogiri: boolean
  /** Concealed hand left after the discard. */
  hand: Pai[]
  /** Waits at this point; empty when not yet tenpai. */
  waits: Pai[]
}

export interface Puzzle {
  target: TargetSeat
  others: Seat[]
  round: RoundInfo
  answer: Pai[]
  kind: 'riichi' | 'open'
  turn: number
  gameId: string
  /** The target's hand after each of their discards. */
  history: HistoryStep[]
}
