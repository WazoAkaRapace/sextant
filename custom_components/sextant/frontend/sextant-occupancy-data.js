/** Room occupancy grouped by floor, from the room sensors' states. No DOM: the tab and the tests share it. */
import { sortFloors } from "./sextant-floors.js";

const ANYONE = /^binary_sensor\..+_sextant_occupancy(_\d+)?$/;
const PEOPLE = /^binary_sensor\..+_sextant_people_occupancy(_\d+)?$/;
const SOURCE_LABEL = { bluetooth: "Bluetooth", radar: "Radar", media_player: "Media playing", sensor: "Sensor", forced: "Forced on", door: "Door held", restored: "Carried over restart", hold: "Holding" };

export function occupancyByFloor(states, planFloors) {
  const rooms = {}, people = {};
  for (const [id, s] of Object.entries(states || {})) {
    const a = s?.attributes || {};
    if (a.room == null || a.floor == null) continue;
    const key = `${a.floor}\u0000${a.room}`;
    if (PEOPLE.test(id)) people[key] = s.state === "on";
    else if (ANYONE.test(id)) rooms[key] = { room: a.room, floor: a.floor, on: s.state === "on", people: a.people || [], pets: a.pets || [], things: a.things || [], sources: (a.sources || []).map((x) => SOURCE_LABEL[x] || x) };
  }
  const byFloor = {};
  for (const [key, r] of Object.entries(rooms)) {
    r.peopleOn = people[key] ?? r.people.length > 0;
    (byFloor[r.floor] ||= []).push(r);
  }
  const names = sortFloors(planFloors).map((f) => f.name);
  for (const n of Object.keys(byFloor)) if (!names.includes(n)) names.push(n);
  return names.filter((n) => byFloor[n]).map((name) => {
    const list = byFloor[name].sort((a, b) => a.room.localeCompare(b.room));
    return { name, rooms: list, people: new Set(list.flatMap((r) => r.people)).size, pets: new Set(list.flatMap((r) => r.pets)).size };
  });
}
