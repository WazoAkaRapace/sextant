"""Where each thing usually is, by day type and hour.

A phone that sits on a bedside table at 07:00 on a weekday and in the kitchen
at 07:30 has a routine. Counting the seconds each thing spends in each room,
per weekday/weekend and hour of day, gives a prior for the one decision that
is a coin toss: a thing on the line between two rooms. ``prior_shift`` turns it
into a small change to the margin a challenger room must beat (see
``_elect_zone``). It never picks a room: clear evidence ignores it.

Only confident elections count (the caller's say), and every slot forgets
with a half-life of ``HALF_LIFE_S`` so a changed routine takes over in weeks.
The table is the house's own routine, so it stays in config/.storage and is
shown nowhere else; ``habit_margin_gain`` = 0 turns its use off.
"""
from __future__ import annotations

import math
from datetime import datetime

HALF_LIFE_S = 21 * 86400.0
MAX_STEP_S = 60.0          # one update counts at most a minute: a gap is not time spent
MIN_SLOT_S = 20 * 60.0     # less than this in a slot says nothing yet
MAX_ZONES_PER_SLOT = 12    # a slot keeps its busiest rooms; the rest are noise
MAX_THINGS = 200


def new_store() -> dict:
    return {}


def slot_of(now: float, tz=None) -> str:
    """'wd14' / 'we14': weekday or weekend, and the local hour."""
    when = datetime.fromtimestamp(now, tz)
    return f"{'we' if when.weekday() >= 5 else 'wd'}{when.hour}"


def clean(raw) -> dict:
    """A stored table made safe to use: anything malformed is dropped."""
    out: dict = {}
    if not isinstance(raw, dict):
        return out
    for ent, slots in list(raw.items())[:MAX_THINGS]:
        if not isinstance(ent, str) or not isinstance(slots, dict):
            continue
        for slot, row in slots.items():
            zones = row.get("z") if isinstance(row, dict) else None
            at = row.get("at") if isinstance(row, dict) else None
            if not isinstance(slot, str) or not isinstance(zones, dict) or isinstance(at, bool) or not isinstance(at, (int, float)):
                continue
            good = {z: float(s) for z, s in zones.items()
                    if isinstance(z, str) and isinstance(s, (int, float)) and not isinstance(s, bool) and math.isfinite(s) and s > 0}
            if good:
                out.setdefault(ent, {})[slot] = {"at": float(at), "z": good}
    return out


def learn(store: dict, ent: str, zone: str, now: float, last: float | None, tz=None) -> None:
    """Add the time since ``last`` (at most MAX_STEP_S) to ``zone`` in this slot."""
    if not zone or zone == "unknown" or last is None or now <= last:
        return
    row = store.setdefault(ent, {}).setdefault(slot_of(now, tz), {"at": now, "z": {}})
    zones = row["z"]
    keep = 0.5 ** (max(0.0, now - row["at"]) / HALF_LIFE_S)
    if keep < 1.0:
        for z in zones:
            zones[z] *= keep
    row["at"] = now
    zones[zone] = zones.get(zone, 0.0) + min(now - last, MAX_STEP_S)
    if len(zones) > MAX_ZONES_PER_SLOT:
        for z in sorted(zones, key=zones.get)[:len(zones) - MAX_ZONES_PER_SLOT]:
            del zones[z]
    if len(store) > MAX_THINGS:
        store.pop(next(iter(store)), None)


def share(store: dict, ent: str, zone: str, now: float, tz=None) -> float | None:
    """The fraction of this slot's time the thing spent in ``zone``, or None
    while the slot has too little history to say anything."""
    row = (store.get(ent) or {}).get(slot_of(now, tz))
    if not row:
        return None
    total = sum(row["z"].values())
    return None if total < MIN_SLOT_S else row["z"].get(zone, 0.0) / total


def prior_shift(store: dict, ent: str, incumbent: str, challenger: str, now: float, gain: float, tz=None) -> float:
    """How much to move the margin a challenger must lead by: negative when
    the challenger is the habit, positive when the incumbent is. Within
    +-``gain``, and 0 when there is no history or gain is 0."""
    if gain <= 0:
        return 0.0
    a, b = share(store, ent, incumbent, now, tz), share(store, ent, challenger, now, tz)
    if a is None or b is None:
        return 0.0
    return gain * (a - b)
