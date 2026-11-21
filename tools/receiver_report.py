#!/usr/bin/env python3
"""
Which receivers earn their place?

Reads the election log and, for every placed receiver, says how often it was
part of the elected floor's fix and how its ranges sat against that fix:

``heard``  cycles it was in the elected floor's solve.
``bias``   median of (its range - its distance to the fix), in metres. A
           receiver that always reads long or short is miscalibrated or
           misplaced; near zero is good.
``spread`` median of the absolute difference: how noisy it is.

The fix is built from these same ranges, so a receiver pulls the fix towards
agreeing with it: the figures understate a bad receiver, most of all where
few others hear the thing. Worst bias first.

Usage::

    python tools/receiver_report.py config/sextant_election_log --layout config/.storage/sextant
    python tools/receiver_report.py log/ --layout layout.json --hours 24 --min 50
"""

from __future__ import annotations

import argparse
import collections
import math
import os
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from replay_cross_floor import load_layout, load_rows  # noqa: E402

# shortcut: one height for things and unset receivers, read thing_heights and the class defaults if the bias of ceiling receivers matters.
DEFAULT_HEIGHT_M = 1.0


def receivers_of(layout):
    """{floor: (scale, {receiver: (x, y, height)})} for the placed receivers."""
    out = {}
    for f in layout.get("floor", []):
        scale = float(f.get("scale") or 0)
        if scale > 0:
            out[f.get("name")] = (scale, {
                r.get("entity_id"): (r["cords"]["x"], r["cords"]["y"], float(r.get("height") or DEFAULT_HEIGHT_M))
                for r in f.get("receivers", []) if "x" in r.get("cords", {}) and "y" in r.get("cords", {})})
    return out


def report(rows, layout):
    """[(floor, receiver, heard, bias_m, spread_m)], worst bias first."""
    floors, heights = receivers_of(layout), layout.get("thing_heights") or {}
    diffs = collections.defaultdict(list)
    for r in rows:
        cand = (r.get("floor_cands") or {}).get(r.get("floor")) or {}
        fix, (scale, rx) = cand.get("fix"), floors.get(r.get("floor")) or (0, {})
        if not fix or not scale:
            continue
        try:
            thing_h = float(heights.get(r.get("ent")) or DEFAULT_HEIGHT_M)
        except (TypeError, ValueError):
            thing_h = DEFAULT_HEIGHT_M
        for slug, metres in cand.get("heard") or ():
            if slug in rx:
                x, y, h = rx[slug]
                diffs[(r["floor"], slug)].append(metres - math.hypot(math.hypot(fix[0] - x, fix[1] - y) / scale, h - thing_h))
    out = [(floor, slug, len(d), statistics.median(d), statistics.median(abs(v) for v in d)) for (floor, slug), d in diffs.items()]
    return sorted(out, key=lambda row: -abs(row[3]))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("log", help="the election log directory, or one of its files")
    ap.add_argument("--layout", required=True, help="the layout (config/.storage/sextant or a snapshot)")
    ap.add_argument("--hours", type=float, help="only the last N hours of the log")
    ap.add_argument("--min", type=int, default=20, help="leave out receivers heard in fewer cycles (20)")
    args = ap.parse_args(argv)
    layout = load_layout(args.layout)
    lines = report(load_rows(args.log, args.hours), layout)
    seen = {(floor, slug) for floor, slug, *_ in lines}
    print(f"{'floor':16}{'receiver':44}{'heard':>8}{'bias m':>8}{'spread m':>10}")
    for floor, slug, n, bias, spread in lines:
        if n >= args.min:
            print(f"{str(floor)[:15]:16}{slug[:43]:44}{n:>8}{bias:>+8.2f}{spread:>10.2f}")
    silent = sorted((floor, slug) for floor, (_s, rx) in receivers_of(layout).items() for slug in rx if (floor, slug) not in seen)
    if silent:
        print(f"\nNever in an elected floor's fix ({len(silent)}): " + ", ".join(slug for _f, slug in silent))


if __name__ == "__main__":
    main()
