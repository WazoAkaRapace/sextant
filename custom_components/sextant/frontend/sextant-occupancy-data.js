/** Room occupancy grouped by floor, from the room sensors' states. No DOM: the tab and the tests share it. */
import { sortFloors } from "./sextant-floors.js";

export const SOURCE_LABEL = { bluetooth: "Bluetooth", radar: "Radar", media_player: "Media playing", sensor: "Sensor", forced: "Forced on", door: "Door held", restored: "Carried over restart", hold: "Holding" };
export const SOURCE_ICON = { bluetooth: "mdi:bluetooth", radar: "mdi:radar", media_player: "mdi:television-play", sensor: "mdi:motion-sensor", forced: "mdi:toggle-switch", door: "mdi:door", restored: "mdi:restart", hold: "mdi:timer-sand" };

export function occupancyByFloor(states, planFloors) {
  const rooms = new Map(), people = new Map();
  for (const [id, s] of Object.entries(states || {})) {
    const a = s?.attributes || {};
    if (!id.startsWith("binary_sensor.") || a.room == null || a.floor == null) continue;
    const key = `${a.floor}\u0000${a.room}`;
    if (a.people_only) people.set(key, s.state === "on");
    else rooms.set(key, { room: a.room, floor: a.floor, on: s.state === "on", people: a.people || [], pets: a.pets || [], things: a.things || [], ids: a.ids || {}, sources: a.sources || [] });
  }
  const byFloor = new Map();
  for (const [key, r] of rooms) {
    r.peopleOn = people.get(key) ?? r.people.length > 0;
    if (!byFloor.has(r.floor)) byFloor.set(r.floor, []);
    byFloor.get(r.floor).push(r);
  }
  const names = sortFloors(planFloors).map((f) => f.name);
  for (const n of byFloor.keys()) if (!names.includes(n)) names.push(n);
  return names.filter((n) => byFloor.has(n)).map((name) => {
    const list = byFloor.get(name).sort((a, b) => a.room.localeCompare(b.room));
    return { name, rooms: list, people: new Set(list.flatMap((r) => r.people)).size, pets: new Set(list.flatMap((r) => r.pets)).size };
  });
}

export const WHERE_SOURCE = { ble: "Bluetooth", wifi: "Wi-Fi", gps: "GPS", held: "Bluetooth (held)", none: "None" };
export const WHERE_ICON = { ble: "mdi:bluetooth", wifi: "mdi:wifi", gps: "mdi:crosshairs-gps", held: "mdi:bluetooth-off", none: "mdi:help-circle-outline" };

/** People and pets whose Sextant location is Outside (beyond every room, still at home). */
// shortcut: only pets with a person.* entity are listed; a tag-only pet outside shows nowhere. Add layout thing_classes if one appears.
export function outsideNow(states) {
  states = states || {};
  const people = [], pets = [];
  for (const [id, s] of Object.entries(states)) {
    if (!id.startsWith("person.")) continue;
    const slug = id.slice(7);
    const pet = states[`sensor.${slug}_sextant_pet_location`];
    const loc = states[`sensor.${slug}_sextant_person_location`] || pet;
    if (loc?.attributes?.kind === "outside") (loc === pet ? pets : people).push(s.attributes?.friendly_name || slug);
  }
  return { people: people.sort(), pets: pets.sort() };
}

/** Where a chip's person, pet or thing is, from its location sensors; null when it has none.
 *  ``ids`` is the room sensor's {display name: thing slug}; a person (or a pet that is a
 *  person) is found by the friendly name the room sensor listed them under. */
export function chipDetail(states, name, ids) {
  states = states || {};
  const person = Object.keys(states).find((id) => id.startsWith("person.") && (states[id]?.attributes?.friendly_name || id.slice(7)) === name);
  const slug = person?.slice(7);
  const loc = slug ? states[`sensor.${slug}_sextant_person_location`] || states[`sensor.${slug}_sextant_pet_location`] : null;
  const via = loc ? loc.attributes?.via : ids?.[name];
  const thing = via && !String(via).includes(".") ? via : null;   // a Wi-Fi via is a device_tracker, not a thing
  const tloc = thing ? states[`sensor.${thing}_sextant_location`] : null;
  const s = loc || tloc;
  if (!s) return null;
  const a = s.attributes || {}, t = tloc?.attributes || {};
  const heard = a.last_heard || t.last_heard;
  const spot = a.spot && a.spot !== "unknown" ? a.spot : null;
  return {
    thing, room: a.room, spot, floor: a.floor, presence: a.presence,
    conf: a.conf ?? t.conf ?? null, source: a.source || "ble",
    accessPoint: a.access_point || null, gpsAccuracy: a.gps_accuracy ?? null,
    heardAt: heard ? Date.parse(heard) : null,
  };
}

/** A person's chip label: the first word of their name, capitalised ("david coulson" -> "David"). */
export const firstName = (name) => { const w = String(name ?? "").trim().split(/\s+/)[0]; return w ? w[0].toUpperCase() + w.slice(1) : String(name ?? ""); };
