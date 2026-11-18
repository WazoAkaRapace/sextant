import test from "node:test";
import assert from "node:assert/strict";
import { occupancyByFloor } from "../../custom_components/sextant/frontend/sextant-occupancy-data.js";

const st = (state, room, floor, extra = {}) => ({ state, attributes: { room, floor, people: [], pets: [], sources: [], ...extra } });

test("rooms group by floor, top floor first, with people and pets counted", () => {
  const states = {
    "binary_sensor.great_room_sextant_occupancy": st("on", "Great Room", "Ground", { people: ["Jack"], pets: ["Primrose"], sources: ["bluetooth", "media_player"] }),
    "binary_sensor.great_room_sextant_people_occupancy": st("on", "Great Room", "Ground", { people_only: true }),
    "binary_sensor.kitchen_sextant_occupancy": st("on", "Kitchen", "Ground", { pets: ["Cat"] }),
    "binary_sensor.kitchen_sextant_people_occupancy": st("off", "Kitchen", "Ground", { people_only: true }),
    "binary_sensor.renamed": st("on", "Den", "constructor"),
    "binary_sensor.office_sextant_occupancy": st("off", "Office", "Upper"),
    "sensor.other": { state: "1", attributes: {} },
  };
  const out = occupancyByFloor(states, [{ name: "Ground", level: 0 }, { name: "Upper", level: 1 }]);
  assert.deepEqual(out.map((f) => f.name), ["Upper", "Ground", "constructor"]);
  const g = out[1];
  assert.equal(out[2].rooms[0].room, "Den");
  assert.equal(g.people, 1); assert.equal(g.pets, 2);
  assert.equal(g.rooms.find((r) => r.room === "Kitchen").peopleOn, false);
  assert.deepEqual(g.rooms.find((r) => r.room === "Great Room").sources, ["bluetooth", "media_player"]);
});
