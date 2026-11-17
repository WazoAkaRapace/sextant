"""Where a thing usually is, by hour (habits.py), and its pull on a close room switch."""
import sextant  # noqa: F401
from datetime import datetime, timezone

from sextant import habits

MON_7AM = datetime(2026, 11, 16, 7, 0, tzinfo=timezone.utc).timestamp()   # a Monday
SAT_7AM = datetime(2026, 11, 21, 7, 0, tzinfo=timezone.utc).timestamp()


def _spend(store, ent, zone, start, secs):
    t = start
    while t < start + secs:
        habits.learn(store, ent, zone, t + 30, t, timezone.utc)
        t += 30


def test_slots_split_weekday_and_weekend():
    assert habits.slot_of(MON_7AM, timezone.utc) == "wd7" and habits.slot_of(SAT_7AM, timezone.utc) == "we7"


def test_a_routine_tips_a_close_call_only_once_there_is_history():
    s = habits.new_store()
    assert habits.prior_shift(s, "p", "Kitchen", "Foyer", MON_7AM, 0.1, timezone.utc) == 0.0   # no history
    _spend(s, "p", "Kitchen", MON_7AM, 40 * 60)
    _spend(s, "p", "Foyer", MON_7AM + 40 * 60, 10 * 60)
    now = MON_7AM + 50 * 60
    toward_kitchen = habits.prior_shift(s, "p", "Foyer", "Kitchen", now, 0.1, timezone.utc)
    assert toward_kitchen < 0                                      # kitchen is the habit: an easier switch into it
    assert habits.prior_shift(s, "p", "Kitchen", "Foyer", now, 0.1, timezone.utc) > 0
    assert abs(toward_kitchen) <= 0.1
    assert habits.prior_shift(s, "p", "Foyer", "Kitchen", now, 0.0, timezone.utc) == 0.0     # gain 0 = off
    assert habits.prior_shift(s, "p", "Foyer", "Kitchen", SAT_7AM + 3600, 0.1, timezone.utc) == 0.0   # weekend: no history


def test_old_time_fades_and_the_table_stays_bounded_and_clean():
    s = habits.new_store()
    _spend(s, "p", "A", MON_7AM, 30 * 60)
    row = s["p"]["wd7"]
    before = row["z"]["A"]
    habits.learn(s, "p", "B", MON_7AM + 21 * 86400 + 30, MON_7AM + 21 * 86400, timezone.utc)   # same slot, a half-life later
    assert row["z"]["A"] < before * 0.6
    assert habits.clean({"p": {"wd7": {"at": 1, "z": {"A": 5, "B": -1, "C": "x"}}, "bad": 3}, 4: {}}) == {"p": {"wd7": {"at": 1.0, "z": {"A": 5.0}}}}
    assert habits.clean("junk") == {}
