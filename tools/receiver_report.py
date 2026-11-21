#!/usr/bin/env python3
"""
Which receivers earn their place?

Reads the election log and, for every placed receiver, says how often it was
part of the elected floor's fix and how its ranges sat against that fix:

``heard``  cycles it was among the elected floor's proxies.
``bias``   median of (its range - its distance to the fix), in metres. A
           receiver that always reads long or short is miscalibrated or
           misplaced; near zero is good.
``off``    median of the absolute difference: bias and noise together.

The fix is built from these same ranges, so a receiver pulls the fix towards
agreeing with it: the figures understate a bad receiver, most of all where
few others hear the thing. A fingerprint-only fix did not use the ranges at
all but is counted the same. Worst bias first.

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

# As the live solve (_thing_height in the integration): the thing's own height,
# 0.1 m for a robot, the layout-wide thing_height, then 1 m.
DEFAULT_HEIGHT_M = 1.0
ROBOT_HEIGHT_M = 0.1


def _height(value):
    ok = isinstance(value, (int, float)) and not isinstance(value, bool) and 0 <= value <= 5
    return float(value) if ok else None


def thing_height(layout, ent):
    own = _height((layout.get("thing_heights") or {}).get(ent))
    if own is not None:
        return own
    if (layout.get("thing_classes") or {}).get(ent) == "robot":
        return ROBOT_HEIGHT_M
    shared = _height(layout.get("thing_height"))
    return DEFAULT_HEIGHT_M if shared is None else shared


def receivers_of(layout):
    """{floor: (scale, {receiver: (x, y, height)})} for the placed receivers."""
    out = {}
    for f in layout.get("floor", []):
        scale = float(f.get("scale") or 0)
        if scale > 0:
            out[f.get("name")] = (scale, {
                r.get("entity_id"): (r["cords"]["x"], r["cords"]["y"], DEFAULT_HEIGHT_M if _height(r.get("height")) is None else _height(r.get("height")))
                for r in f.get("receivers", []) if "x" in r.get("cords", {}) and "y" in r.get("cords", {})})
    return out


def report(rows, layout):
    """[(floor, receiver, heard, bias_m, off_m)], worst bias first."""
    floors = receivers_of(layout)
    diffs = collections.defaultdict(list)
    for r in rows:
        cand = (r.get("floor_cands") or {}).get(r.get("floor")) or {}
        fix, (scale, rx) = cand.get("fix"), floors.get(r.get("floor")) or (0, {})
        if not fix or not scale:
            continue
        thing_h = thing_height(layout, r.get("ent"))
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
    print(f"{'floor':16}{'receiver':44}{'heard':>8}{'bias m':>8}{'off m':>10}")
    for floor, slug, n, bias, off in lines:
        if n >= args.min:
            print(f"{str(floor)[:15]:16}{slug[:43]:44}{n:>8}{bias:>+8.2f}{off:>10.2f}")
    silent = sorted((floor, slug) for floor, (_s, rx) in receivers_of(layout).items() for slug in rx if (floor, slug) not in seen)
    if silent:
        print(f"\nNever in an elected floor's fix ({len(silent)}): " + ", ".join(slug for _f, slug in silent))


if __name__ == "__main__":
    main()
