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
    else rooms.set(key, { room: a.room, floor: a.floor, on: s.state === "on", people: a.people || [], pets: a.pets || [], things: a.things || [], sources: a.sources || [] });
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
