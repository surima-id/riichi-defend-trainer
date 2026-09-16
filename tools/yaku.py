"""Does a completed hand hold at least one yaku?

Needed because a hand without a yaku cannot ron. Players regularly take
keishiki tenpai -- calling a hand into a shape that is tenpai but yakuless,
purely to collect noten payments at an exhaustive draw. Such a hand's "wait"
completes it arithmetically but no one can ever deal into it, so for safety
reading those tiles are not dangerous at all.

Only the yes/no question is answered; han are never counted. Situational yaku
(haitei, houtei, chankan, rinshan) depend on when the tile appears rather than
on the hand, so they are not considered -- a houtei ron on the very last
discard can technically claim a yakuless hand, which is the one case this
treats as safe when it is not.
"""

from mjtiles import to_counts

MAN, PIN, SOU, HONOR = range(0, 9), range(9, 18), range(18, 27), range(27, 34)
WIND_INDEX = {"E": 27, "S": 28, "W": 29, "N": 30}
DRAGONS = (31, 32, 33)
TERMINALS = frozenset([0, 8, 9, 17, 18, 26])
HONORS = frozenset(range(27, 34))
TERMINAL_OR_HONOR = TERMINALS | HONORS
# Bamboo 2/3/4/6/8 plus green dragon: the only tiles in ryuuiisou.
GREEN = frozenset([19, 20, 21, 23, 25, 32])


def _suit(i):
    return i // 9 if i < 27 else 3


def _is_run_start(i):
    return i < 27 and i % 9 <= 6


def _sets(counts, need):
    """Yield every way to split `counts` into `need` runs/triplets."""
    if need == 0:
        if not any(counts):
            yield []
        return
    i = next((k for k, c in enumerate(counts) if c > 0), None)
    if i is None:
        return
    if counts[i] >= 3:
        counts[i] -= 3
        for rest in _sets(counts, need - 1):
            yield [("t", i)] + rest
        counts[i] += 3
    if _is_run_start(i) and counts[i + 1] > 0 and counts[i + 2] > 0:
        counts[i] -= 1
        counts[i + 1] -= 1
        counts[i + 2] -= 1
        for rest in _sets(counts, need - 1):
            yield [("r", i)] + rest
        counts[i] += 1
        counts[i + 1] += 1
        counts[i + 2] += 1


def _decompose(counts, need):
    """Yield (pair_index, sets) for every standard parse of the concealed part."""
    for p in range(34):
        if counts[p] >= 2:
            counts[p] -= 2
            for sets in _sets(counts[:], need):
                yield p, sets
            counts[p] += 2


def _meld_set(m):
    """A called meld as the same ('t'|'r', index) shape a parse uses."""
    c = to_counts(m["tiles"])
    idx = [i for i, n in enumerate(c) if n > 0]
    if len(idx) == 1:
        return ("t", idx[0])
    return ("r", min(idx))


def _all_tiles(concealed, melds):
    c = to_counts(concealed)
    for m in melds:
        for i, n in enumerate(to_counts(m["tiles"])):
            # A kan contributes four tiles but only ever one set; counted as
            # three so the 14-tile shape checks stay consistent.
            c[i] += min(n, 3)
    return c


def has_yaku(concealed, melds, bakaze, seat_wind, win_tile=None, riichi=False):
    """True if this complete hand can claim at least one yaku on a ron.

    `concealed` includes the winning tile. `melds` are the called sets as
    extract.py records them. Menzen-only yaku are allowed only when every meld
    is an ankan, which is the one way a hand here can still be closed.
    """
    if riichi:
        return True
    counts = _all_tiles(concealed, melds)
    menzen = all(m["type"] == "ankan" for m in melds)
    n_called = len(melds)

    # --- whole-hand yaku: no parse needed ---------------------------------
    present = [i for i, c in enumerate(counts) if c > 0]
    suits = {_suit(i) for i in present}

    if not any(i in TERMINAL_OR_HONOR for i in present):
        return True                                    # tanyao
    if suits <= {3}:
        return True                                    # tsuuiisou
    if len(suits - {3}) == 1 and (3 in suits):
        return True                                    # honitsu
    if len(suits) == 1 and 3 not in suits:
        return True                                    # chinitsu
    if all(i in TERMINAL_OR_HONOR for i in present):
        return True                                    # honroutou / chinroutou
    if all(i in GREEN for i in present):
        return True                                    # ryuuiisou

    # Yakuhai: dragons, and the player's own two winds.
    honor_triplets = {i for i in DRAGONS if counts[i] >= 3}
    for w in (bakaze, seat_wind):
        i = WIND_INDEX.get(w)
        if i is not None and counts[i] >= 3:
            honor_triplets.add(i)
    if honor_triplets:
        return True

    if len([m for m in melds if m["type"] in ("ankan", "kakan", "daiminkan")]) >= 4:
        return True                                    # suukantsu

    # --- chiitoitsu: closed only, and never alongside a kan ---------------
    if menzen and not melds and sum(1 for c in counts if c == 2) == 7:
        return True

    # --- parse-dependent yaku ---------------------------------------------
    called = [_meld_set(m) for m in melds]
    for pair, sets in _decompose(to_counts(concealed), 4 - n_called):
        blocks = called + sets
        if _parse_has_yaku(blocks, pair, melds, menzen, win_tile,
                           bakaze, seat_wind):
            return True
    return False


def _yakuhai_pair(pair, bakaze, seat_wind):
    return pair in DRAGONS or pair in {
        WIND_INDEX[w] for w in (bakaze, seat_wind) if w in WIND_INDEX
    }


def _parse_has_yaku(blocks, pair, melds, menzen, win_tile, bakaze, seat_wind):
    kinds = [k for k, _ in blocks]
    idx = [i for _, i in blocks]
    runs = [i for k, i in blocks if k == "r"]
    trips = [i for k, i in blocks if k == "t"]

    if len(trips) == 4:
        return True                                    # toitoi

    # Chanta / junchan: every block and the pair touches a terminal or honour.
    def touches(k, i):
        if k == "t":
            return i in TERMINAL_OR_HONOR
        return i in TERMINALS or i + 2 in TERMINALS
    if all(touches(k, i) for k, i in blocks) and pair in TERMINAL_OR_HONOR:
        return True

    # Ittsu: 123/456/789 in one suit.
    for base in (0, 9, 18):
        if all(base + o in runs for o in (0, 3, 6)):
            return True

    # Sanshoku doujun / doukou: the same number across all three suits.
    for n in range(9):
        if all(n + s * 9 in runs for s in range(3)) and n <= 6:
            return True
        if all(n + s * 9 in trips for s in range(3)):
            return True

    # Sanankou: three concealed triplets. The triplet the winning tile
    # completes is scored as open on a ron, so it does not count.
    concealed_trips = [i for k, i in zip(kinds, idx) if k == "t"]
    open_trip_indices = {i for m, (k, i) in zip(melds, blocks[: len(melds)])
                         if k == "t" and m["type"] != "ankan"}
    n_ankou = sum(1 for i in concealed_trips if i not in open_trip_indices)
    if win_tile is not None:
        wc = to_counts([win_tile])
        w = next((i for i, c in enumerate(wc) if c), None)
        if w in concealed_trips and w not in open_trip_indices:
            n_ankou -= 1
    if n_ankou >= 3:
        return True

    if menzen:
        # Iipeiko / ryanpeikou: the same run twice.
        if any(runs.count(r) >= 2 for r in set(runs)):
            return True
        if _is_pinfu(runs, pair, win_tile, bakaze, seat_wind):
            return True

    return False


def _is_pinfu(runs, pair, win_tile, bakaze, seat_wind):
    """All runs, a valueless pair, and the win completes a two-sided wait.

    The two-sided requirement is what rules out a run finished in the middle
    (kanchan) or on its closed end (penchan), both of which score fu and so
    cannot be pinfu.
    """
    if len(runs) != 4 or _yakuhai_pair(pair, bakaze, seat_wind):
        return False
    if win_tile is None:
        # No winning tile to check the wait against; assume the shape holds
        # rather than claim a hand is yakuless on incomplete information.
        return True
    wc = to_counts([win_tile])
    w = next((i for i, c in enumerate(wc) if c), None)
    for r in runs:
        # 12_3 and 1_23 are penchan/kanchan; only the open ends qualify, and a
        # 123 run cannot be completed two-sidedly on the 3 (nor 789 on the 7).
        if w == r and r % 9 != 6:
            return True
        if w == r + 2 and r % 9 != 0:
            return True
    return False
