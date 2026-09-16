export type Pai = string

export interface RiverTile {
  pai: Pai
  /** True when cut straight from the draw; false means it came from hand. */
  tsumogiri: boolean
  /** True on the riichi declaration tile. */
  riichi: boolean
  /**
   * Seat wind of the player who called this tile away, or null.
   *
   * The wind rather than a flag: two players can call the same tile face, and
   * a bare "this was called" leaves the reader unable to tell which meld it
   * went into.
   */
  calledBy: string | null
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
  /**
   * The subset of `answer` that can actually be ronned.
   *
   * A hand with no yaku cannot claim a discard, so its waits complete the
   * shape without ever being dealt into. Players reach these shapes on purpose
   * -- keishiki tenpai, called purely to collect noten payments at a draw --
   * and for safety reading such tiles are not dangerous. Equal to `answer` for
   * every riichi hand, since riichi is itself a yaku.
   */
  ronAnswer: Pai[]
  kind: 'riichi' | 'open'
  turn: number
  gameId: string
  /** The target's hand after each of their discards. */
  history: HistoryStep[]
}
