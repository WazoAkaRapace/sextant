from shapely.geometry import box

import sextant as s


def test_no_go_penalty_ramps_in_from_the_edge():
    polys = [("v", box(0, 0, 400, 400), 0, True)]  # 4 m square void at 100 px/m
    f = lambda x: s._no_go_factor((x, 200), polys, 100)
    assert f(-10) == 1.0                      # outside
    assert f(50) == 1.0                       # 0.5 m in: within the fit's error of the walkway
    assert abs(f(200) - s.NO_GO_CONF_PENALTY) < 1e-9    # 2 m in: plainly over the void
    assert 1.0 > f(112.5) > s.NO_GO_CONF_PENALTY
    assert s._no_go_factor((50, 200), polys, None) == s.NO_GO_CONF_PENALTY
    assert s._no_go_factor((50, 200), [("r", box(0, 0, 400, 400), 0, False)], 100) == 1.0
