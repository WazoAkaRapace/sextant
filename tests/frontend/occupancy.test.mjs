import test from "node:test";
import assert from "node:assert/strict";
import { occupancyByFloor, spotInRoom } from "../../custom_components/sextant/frontend/sextant-occupancy-data.js";

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

test("chipDetail finds a pet's spot through its person, and a bare thing through the room's ids", async () => {
  const { chipDetail } = await import("../../custom_components/sextant/frontend/sextant-occupancy-data.js");
  const states = {
    "person.fry": { state: "home", attributes: { friendly_name: "Fry" } },
    "sensor.fry_sextant_pet_location": { state: "Meg's Cafe", attributes: { room: "Catwalk", spot: "Meg's Cafe", floor: "Second Floor", conf: 0.72, source: "ble", via: "fry_tag" } },
    "sensor.fry_tag_sextant_location": { state: "Meg's Cafe", attributes: { room: "Catwalk", spot: "Meg's Cafe", last_heard: "2026-11-18T18:30:26+00:00" } },
    "sensor.cat_tag_sextant_location": { state: "Kitchen", attributes: { room: "Kitchen", spot: null, floor: "Ground", conf: 0.5 } },
    "person.david": { state: "home", attributes: { friendly_name: "David" } },
    "sensor.david_sextant_person_location": { state: "home", attributes: { room: "unknown", floor: "Ground", source: "wifi", via: "device_tracker.david_phone", access_point: "Hall AP" } },
  };
  const fry = chipDetail(states, "Fry", {});
  assert.equal(fry.spot, "Meg's Cafe"); assert.equal(fry.thing, "fry_tag");
  assert.equal(fry.heardAt, Date.parse("2026-11-18T18:30:26+00:00"));
  const cat = chipDetail(states, "Cat", { Cat: "cat_tag" });
  assert.equal(cat.room, "Kitchen"); assert.equal(cat.spot, null); assert.equal(cat.source, "ble");
  const david = chipDetail(states, "David", {});
  assert.equal(david.thing, null); assert.equal(david.source, "wifi"); assert.equal(david.accessPoint, "Hall AP");
  assert.equal(chipDetail(states, "Nobody", {}), null);
});

test("firstName keeps the first word, capitalised", async () => {
  const { firstName } = await import("../../custom_components/sextant/frontend/sextant-occupancy-data.js");
  assert.equal(firstName("david coulson"), "David");
  assert.equal(firstName("Eilee"), "Eilee");
  assert.equal(firstName("  meg  "), "Meg");
  assert.equal(firstName(""), "");
});

test("outsideNow lists people and pets whose location is Outside", async () => {
  const { outsideNow } = await import("../../custom_components/sextant/frontend/sextant-occupancy-data.js");
  const states = {
    "person.primrose": { attributes: { friendly_name: "Primrose" } },
    "sensor.primrose_sextant_pet_location": { state: "Outside", attributes: { kind: "outside", room: "Outside" } },
    "person.david": { attributes: { friendly_name: "David Coulson" } },
    "sensor.david_sextant_person_location": { state: "Kitchen", attributes: { kind: "room", room: "Kitchen" } },
    "person.alex": { attributes: { friendly_name: "Alex" } },
    "sensor.alex_sextant_person_location": { state: "Outside", attributes: { kind: "outside" } },
  };
  assert.deepEqual(outsideNow(states), { people: ["Alex"], pets: ["Primrose"] });
  assert.deepEqual(outsideNow(undefined), { people: [], pets: [] });
});

test("a spot drops its room's name from its front, but never down to nothing", () => {
  assert.equal(spotInRoom("Eilee Bedside Table", "Eilee's Room"), "Bedside Table");
  assert.equal(spotInRoom("Kitchen Island", "Kitchen"), "Island");
  assert.equal(spotInRoom("Desk", "Office"), "Desk");
  assert.equal(spotInRoom("Kitchen", "Kitchen"), "Kitchen");
  assert.equal(spotInRoom("Bed by the Room door", "Eilee's Room"), "Bed by the Room door");
  assert.equal(spotInRoom("Room Divider", "Living Room"), "Room Divider");
  assert.equal(spotInRoom("Living Room Couch", "Living Room"), "Couch");
  assert.equal(spotInRoom("Living Room", "Living Room"), "Living Room");
  assert.equal(spotInRoom("Eilee’s Desk", "Eilee's Room"), "Desk");
  assert.equal(spotInRoom(undefined, "Kitchen"), "");
});
