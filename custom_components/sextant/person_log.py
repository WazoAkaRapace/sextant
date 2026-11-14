"""A record of why each person reads where they do: one JSON line each time
their source (BLE, held, Wi-Fi, GPS), presence, home/away or Wi-Fi word
changes, in daily files under config/sextant_person_log. It exists to measure
how often Wi-Fi is behind a wrong location or a false arrival (the history
files hold BLE placements only; Home Assistant's history drops attributes).
Room changes are not rows. This module imports nothing from the package."""
import json
import os
import time

LOG_DIRNAME = "sextant_person_log"
KEEP_DAYS = 30


def row(person, now, source, presence, state, home, wifi_raw, wifi_used, ble_age, gps_zone, ap=None):
    """The line for one person's cycle, or its key: (row, key) - the key is what
    must differ from the last one for the row to be written."""
    key = (source, presence, bool(home), bool(wifi_raw), bool(wifi_used), gps_zone)
    return {"t": round(now, 1), "p": person, "src": source, "pres": presence, "state": state, "home": bool(home),
            "wifi": bool(wifi_raw), "wifi_used": bool(wifi_used), "ble_age": None if ble_age is None else round(ble_age),
            "gps": gps_zone, "ap": ap}, key


def append(dirpath, rows, now=None):
    """Append ``rows`` to today's file and drop files older than KEEP_DAYS.
    Blocking: run it in an executor."""
    now = time.time() if now is None else now
    os.makedirs(dirpath, exist_ok=True)
    name = time.strftime("%Y%m%d.jsonl", time.gmtime(now))
    with open(os.path.join(dirpath, name), "a", encoding="utf-8") as f:
        f.write("".join(json.dumps(r, separators=(",", ":")) + "\n" for r in rows))
    cutoff = time.strftime("%Y%m%d.jsonl", time.gmtime(now - KEEP_DAYS * 86400))
    for n in os.listdir(dirpath):
        if n.endswith(".jsonl") and n < cutoff:
            os.remove(os.path.join(dirpath, n))
