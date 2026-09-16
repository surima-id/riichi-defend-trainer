"""Standard-shape win detection and wait enumeration."""

from mjtiles import ALL_TILES, TILE_INDEX, to_counts


def _is_honor(i: int) -> bool:
    return i >= 27


def _can_form_melds(counts, need):
    """Can the remaining tiles be split into `need` melds (sets/runs)?"""
    if need == 0:
        return all(c == 0 for c in counts)
    i = next((k for k, c in enumerate(counts) if c > 0), None)
    if i is None:
        return False
    # triplet
    if counts[i] >= 3:
        counts[i] -= 3
        if _can_form_melds(counts, need - 1):
            counts[i] += 3
            return True
        counts[i] += 3
    # run (suited only, not spanning suit boundaries)
    if not _is_honor(i) and i % 9 <= 6 and counts[i + 1] > 0 and counts[i + 2] > 0:
        counts[i] -= 1
        counts[i + 1] -= 1
        counts[i + 2] -= 1
        if _can_form_melds(counts, need - 1):
            counts[i] += 1
            counts[i + 1] += 1
            counts[i + 2] += 1
            return True
        counts[i] += 1
        counts[i + 1] += 1
        counts[i + 2] += 1
    return False


def is_winning(counts, n_melds_called: int) -> bool:
    """Complete hand? Covers standard, chiitoitsu and kokushi."""
    total = sum(counts)
    need = 4 - n_melds_called
    if total != need * 3 + 2:
        return False

    if n_melds_called == 0:
        # seven pairs
        if sum(1 for c in counts if c == 2) == 7:
            return True
        # thirteen orphans
        terminals = [i for i in range(34) if _is_honor(i) or i % 9 in (0, 8)]
        if all(counts[i] >= 1 for i in terminals) and sum(counts[i] for i in terminals) == 14:
            return True

    for i in range(34):
        if counts[i] >= 2:
            counts[i] -= 2
            ok = _can_form_melds(counts[:], need)
            counts[i] += 2
            if ok:
                return True
    return False


def waits_for(concealed, n_melds_called: int):
    """Tiles that complete this concealed hand. Returns mjai tile names.

    `concealed` is a list of mjai tile strings (13 - 3*melds tiles).
    """
    counts = to_counts(concealed)
    out = []
    for i, name in enumerate(ALL_TILES):
        if counts[i] >= 4:
            continue  # cannot draw a 5th
        counts[i] += 1
        if is_winning(counts, n_melds_called):
            out.append(name)
        counts[i] -= 1
    return out
