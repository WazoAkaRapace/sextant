"""replay.py: the room election replayed over the election log with other tuning."""
import json

import sextant
from sextant import replay

SCALE = 100.0
LAYOUT = {"floor": [{"name": "F", "scale": SCALE, "receivers": [{"entity_id": "p1", "cords": {"x": 50, "y": 50}}], "zones": [
    {"entity_id": "A", "cords": [{"x": 0, "y": 0}, {"x": 300, "y": 0}, {"x": 300, "y": 300}, {"x": 0, "y": 300}]},
    {"entity_id": "B", "cords": [{"x": 300, "y": 0}, {"x": 600, "y": 0}, {"x": 600, "y": 300}, {"x": 300, "y": 300}]},
]}], "tuning": {"zone_switch_secs": 0, "zone_switch_margin": 0.05, "zone_prob_smoothing": 1.0,
                    "far_move_secs": 0, "far_move_margin": 0, "zone_lock_warmup_secs": 3600}}   # neither the far-move dwell nor the stationary lock


def _rows(t0=1000.0):
    """A thing well inside A, then hopping to B and back every 60 s."""
    rows = []
    for i in range(120):
        in_b = (i // 12) % 2 == 1
        rows.append({"t": t0 + 5 * i, "ent": "cat", "floor": "F", "cords": [450 if in_b else 150, 150],
                     "zone_raw": "B" if in_b else "A", "zone": "B" if in_b else "A", "anchor": None, "rms_m": 0.2, "speed": 0.0})
    return rows


def test_a_longer_dwell_replays_as_fewer_bounces_and_leaves_the_live_state_alone():
    sextant._zone_state.clear()
    out = replay.compare(sextant, LAYOUT, _rows(), {"zone_switch_secs": 120})
    assert out["rows"] == 120 and out["things"] == 1
    assert out["logged"]["bounces"] > 3
    # At the tuning as it is the replay follows the log (a few cycles behind: the log here is the instant room); a 120 s dwell rides the hops out.
    assert out["base"]["agree"] > 0.7 and out["base"]["bounces"] > 3
    assert out["trial"]["switches"] == 0 and out["trial"]["bounces"] == 0
    assert out["things_changed"]["cat"]["trial"] == {"switches": 0, "bounces": 0}
    assert sextant._zone_state == {}                       # ran on its own state
    assert replay.compare(sextant, LAYOUT, [], {}) == {"rows": 0}


def test_load_rows_keeps_the_window_and_skips_what_cannot_be_replayed(tmp_path):
    now = 1795000000.0
    name = sextant.election_log.file_for(now - 600)
    good = {"t": now - 600, "ent": "cat", "floor": "F", "cords": [1, 2], "zone_raw": "A", "zone": "A", "radii_n": 4}
    lines = [json.dumps(good), json.dumps({**good, "t": now - 7 * 3600}), json.dumps({**good, "cords": None}), '{"t": 17']
    (tmp_path / name).write_text("\n".join(lines) + "\n")
    (tmp_path / "notes.txt").write_text("not a log")
    rows = replay.load_rows(str(tmp_path), 6, now=now)
    assert [r["t"] for r in rows] == [now - 600] and "radii_n" not in rows[0]
    assert replay.load_rows(str(tmp_path / "missing"), 6, now=now) == []
