[Sextant](../README.md) › Voice and occupancy

# Occupancy and voice

## What Sextant publishes

| Entity | Meaning |
|---|---|
| `binary_sensor.<room>_sextant_occupancy` | on while anyone is in the room. Attributes: `people`, `pets`, `things`, `count`, `state` (`occupied`, `extended` or `clear`), `since`, `forced`, `hold_over` |
| `binary_sensor.<floor>_sextant_floor_occupancy` | on while anyone is on the floor; `rooms`, `people`, `pets`, `count` |
| `binary_sensor.sextant_house_occupancy` | on while anyone is in the house; the same attributes across all floors |
| `switch.<room>_sextant_force_occupied` | while on, the room's sensor stays on whatever Sextant hears (a still reader, a sleeper); it survives a restart |
| `sensor.sextant_people_home` | how many people are home; `home` and `away` list them |

A restart forgets a hold in progress and starts the "extended" timer again.

Two tuning settings (`sextant.set_tuning`): `room_hold_secs` (default 0) keeps a room on that long after the last reading that put someone there, and `room_extended_secs` (default 600) is how long a stay lasts before `state` reads `extended`. Use `state` in automations to treat a long stay differently from someone passing through.

## Voice (Assist)

The room, floor and house sensors and the force switches are exposed to Assist the first time they are created, unless you have already set their exposure; un-exposing one is respected. Each room's device is put in the room's Home Assistant area, so area-based sentences work. The force switch is a plain switch: "turn on the kitchen force occupied".

For spoken answers (who is in a room, where someone is, who is home) copy two files:

1. `docs/assist/sextant_sentences.yaml` to `/config/custom_sentences/en/sextant.yaml`
2. the contents of `docs/assist/sextant_intents.yaml` into `configuration.yaml` under `intent_script:`

Restart, then ask: "who is in the kitchen", "is anyone in the office", "where is Alex", "who is home". People must be exposed to Assist for "where is" to hear their name. The sentences are English; add another language by translating the sentence file.
