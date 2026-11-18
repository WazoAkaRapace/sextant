/** Occupancy tab: floors stacked like the house, a tile per room with who is in it and why it is on. Read only. */
import { LitElement, html, css, nothing } from "./lit.js";
import { sharedStyles } from "./sextant-ui.js";
import { occupancyByFloor } from "./sextant-occupancy-data.js";

class SextantOccupancy extends LitElement {
  static properties = { hass: {}, data: {} };
  static styles = [sharedStyles, css`
    :host { display: block; overflow-y: auto; padding: 16px; max-width: 900px; margin: 0 auto; }
    .floor { background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
    .fh { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .fh b { flex: 1; font-size: 15px; }
    .pill { font-size: 12px; padding: 2px 10px; border-radius: 8px; background: var(--secondary-background-color); color: var(--secondary-text-color); }
    .pill.on { background: color-mix(in srgb, var(--success-color, #4caf50) 20%, transparent); color: var(--primary-text-color); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
    .room { border: 1px solid var(--divider-color); border-radius: 8px; padding: 8px 10px; min-height: 70px; background: var(--secondary-background-color); }
    .room.on { background: color-mix(in srgb, var(--primary-color) 14%, transparent); border-color: var(--primary-color); }
    .room.pets { background: var(--secondary-background-color); border: 1px dashed var(--primary-color); }
    .rn { font-size: 13px; font-weight: 500; margin-bottom: 6px; }
    .chip { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; margin: 0 4px 4px 0; padding: 2px 7px; border-radius: 10px; background: var(--card-background-color); border: 1px solid var(--divider-color); }
    .chip ha-icon { --mdc-icon-size: 14px; }
    .src { font-size: 11px; color: var(--secondary-text-color); }
  `];

  render() {
    const floors = occupancyByFloor(this.hass?.states, this.data?.layout?.floor);
    if (!floors.length) return html`<div class="empty">No room sensors yet. Draw rooms in Edit.</div>`;
    const people = new Set(floors.flatMap((f) => f.rooms.flatMap((r) => r.people))).size;
    return html`${floors.map((f) => html`
      <div class="floor">
        <div class="fh"><b>${f.name}</b>
          <span class="pill ${f.people ? "on" : ""}">${f.people} ${f.people === 1 ? "person" : "people"}</span>
          ${f.pets ? html`<span class="pill">${f.pets} ${f.pets === 1 ? "pet" : "pets"}</span>` : nothing}</div>
        <div class="grid">${f.rooms.map((r) => html`
          <div class="room ${r.on ? (r.peopleOn ? "on" : "pets") : ""}">
            <div class="rn">${r.room}</div>
            ${r.people.map((p) => html`<span class="chip"><ha-icon icon="mdi:account"></ha-icon>${p}</span>`)}
            ${r.pets.map((p) => html`<span class="chip"><ha-icon icon="mdi:paw"></ha-icon>${p}</span>`)}
            ${r.on ? (r.sources.length ? html`<div class="src">${r.sources.join(", ")}</div>` : nothing) : html`<div class="src">Clear</div>`}
          </div>`)}</div>
      </div>`)}
      <div class="src">${people} ${people === 1 ? "person" : "people"} in the house</div>`;
  }
}
if (!customElements.get("sextant-occupancy")) customElements.define("sextant-occupancy", SextantOccupancy);
