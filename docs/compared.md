[Sextant](../README.md) › Where Sextant fits

# Where Sextant fits

Sextant is the fourth step in a lineage:

1. **[Bermuda](https://github.com/agittins/bermuda)** by [@agittins](https://github.com/agittins)
   reads Bluetooth advertisements through ESPHome and Shelly proxies and
   estimates a distance from every proxy to every device. It publishes a
   nearest *area* per device. It has no floor plan.
2. **[BPS](https://github.com/Hogster/BPS)** by [@Hogster](https://github.com/Hogster)
   put those distances on a floor plan: place the proxies, draw rectangular
   zones, trilaterate, and publish a zone and a floor sensor per device.
3. **[BPS-improved](https://github.com/maxi1134/BPS-improved)** by
   [@maxi1134](https://github.com/maxi1134) added polygon zones, sub-zones,
   proxy auto-calibration, Kalman smoothing, position history, floor
   election by hypothesis competition, no-go zones and a dark panel. BPS
   0.2.0 merged that work upstream.
4. **Sextant** grew out of BPS-improved and rebuilt the positioning and the
   panel. It is a new integration domain (`sextant`) with its own sensors
   and its own panel, developed against
   [a Bermuda fork](https://github.com/davidcoulson/bermuda) that exposes
   the APIs the extra features need.

### Capabilities at a glance

| | Bermuda | BPS | BPS-improved | Sextant |
|---|---|---|---|---|
| Distance per proxy, nearest area | yes | via Bermuda | via Bermuda | via Bermuda |
| Position on a floor plan | no | trilateration | trilateration, bounded to the floor | trilateration fused with proxy fingerprints |
| Rooms | HA areas | rectangles | polygons, adjuster | polygons, adjuster, undo, locks |
| Spots inside a room | no | no | point-in-polygon | elected by probability with dwell |
| Floor | no | nearest proxy | competition between floors | competition, k-nearest proximity, per-floor bias |
| Room stability | n/a | none | none | margin, dwell, stationary lock |
| Near-field anchor | no | no | no | yes |
| Smoothing | per distance | 3-sample average | Kalman | Kalman |
| Proxy calibration | manual rssi offset | no | probes calibrate each other | same, with 3D heights, written into Bermuda if you like |
| Proxy and thing heights | no | no | proxy heights | proxy heights and per-thing carry heights |
| No-go areas | no | no | yes | yes |
| Position history | no | session trail | scrubber, hours to days | scrubber, hours to days |
| Panel | config flow | iframe with a pasted token | dark iframe panel | native Home Assistant panel |
| Manage Bermuda from the panel | n/a | no | no | track, untrack, Find My, Tiles, global options |
| Stability KPI and baselines | no | no | no | yes |
| Live tuning | options flow | no | no | every knob, no restart |
| Units | metres | metres | metres | Home Assistant's unit system |
| Map card | no | yes | with proxy status | same renderer as the panel |
| Updates to clients | polling | polling | polling | websocket push per cycle |
| SciPy | no | required | required | not needed |
| Tiles across address rotation | no | no | no | with the Bermuda fork |

### What Sextant adds to Bermuda

- A position on the floor plan: trilateration fused with fingerprints the
  proxies build by hearing each other's beacons.
- Rooms as polygons with spots and no-go areas. Room and spot elections
  with a margin, a dwell and a stationary lock, so sensors do not flap.
- Floor election by competition between floors, scaled by proximity and a
  per-floor bias that can vary across the plan (a bias field), for landings
  and double-height rooms where both floors hear a thing equally.
- Alignment anchors that say how the floors stack, with an elevation per
  floor: shared named points on every plan, fitted into one house frame,
  with misplaced pins found and named and each floor's scale audited.
- Proxy calibration with 3D heights, written into Bermuda if you like.
- Location pins: say where a thing really is and Sextant finds the settings
  that fit it, and reports accuracy in metres.
- People: things given an owner place that person, by whichever of them is
  moving or most recently arrived, with a GPS tracker to fall back on when
  the house has lost them.
- mmWave presence sensors (Everything Presence, Apollo R PRO-1 and other
  LD2450 boards) on the plan: a thing near a target is put on it, a still
  target and a still thing make a pin nobody had to tap, and a target no
  device accounts for counts as an untracked person and keeps the room's
  occupancy sensor on.
- Roborock vacuums placed from their own maps, lined up with the plan by
  the rooms both maps name.
- Bermuda management from the panel: track, untrack, Find My accessories,
  Tiles followed across address rotation (with the fork).
- Rooms as sensors: an occupancy binary per room that names the people,
  pets and things in it, ready for an aggregator such as Area Occupancy
  Detection, and a count of the people home. See
  [How occupancy works](occupancy.md).
- Five sensors per thing, a map card, services and a websocket push per
  cycle. Pure numpy, no SciPy.

