/** Occupancy tab: floors stacked like the house, a tile per room with who is in it and why it is on. Read only. */
import { LitElement, html, css, nothing } from "./lit.js";
import { sharedStyles, fmtAge, fmtLen, proxyName } from "./sextant-ui.js";
import { occupancyByFloor, outsideNow, chipDetail, firstName, SOURCE_ICON, SOURCE_LABEL, WHERE_SOURCE } from "./sextant-occupancy-data.js";

class SextantOccupancy extends LitElement {
  static properties = { hass: {}, data: {}, _open: { state: true } };

  constructor() {
    super();
    this._open = null;          // "<floor>|<room>|<name>" of the chip whose details are showing
    this._pinned = false;       // opened by a tap or click, so leaving it with the mouse keeps it
    this._readings = {};        // thing slug -> { at, res, loading }: sextant/thing/readings, refreshed while shown
    this.addEventListener("click", (e) => { if (!e.composedPath().some((el) => el.classList?.contains("who"))) this._close(); });
    // On the document: a hover-opened popup has no focus inside this element for Escape to reach.
    this._onKey = (e) => { if (e.key === "Escape" && this._open) this._close(); };
  }

  connectedCallback() { super.connectedCallback(); document.addEventListener("keydown", this._onKey); }
  disconnectedCallback() { super.disconnectedCallback(); document.removeEventListener("keydown", this._onKey); }

  willUpdate() {
    this._floors = occupancyByFloor(this.hass?.states, this.data?.layout?.floor);
    const out = outsideNow(this.hass?.states);
    this._outside = out.people.length || out.pets.length
      ? { name: "Outside", people: out.people.length, pets: out.pets.length, rooms: [{ room: "Outside", floor: "", on: true, peopleOn: out.people.length > 0, ids: {}, sources: [], ...out }] }
      : null;
    // The open chip's occupant left the room (or the house): drop the popup and its pin with it.
    if (this._open && ![...this._floors, ...(this._outside ? [this._outside] : [])].some((f) => f.rooms.some((r) => [...r.people, ...r.pets].some((n) => `${r.floor}|${r.room}|${n}` === this._open)))) this._close();
  }
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
    .room { position: relative; }
    .rn { font-size: 13px; font-weight: 500; margin-bottom: 6px; padding-right: 44px; }
    .src { position: absolute; top: 6px; right: 8px; display: flex; gap: 4px; color: var(--secondary-text-color); }
    .src ha-icon { --mdc-icon-size: 16px; }
    .chip { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; margin: 0 4px 4px 0; padding: 2px 7px; border-radius: 10px; background: var(--card-background-color); border: 1px solid var(--divider-color); }
    .foot { font-size: 12px; color: var(--secondary-text-color); }
    .chip ha-icon { --mdc-icon-size: 14px; }
    .who { position: relative; display: inline-block; }
    button.chip { font: inherit; font-size: 12px; color: var(--primary-text-color); cursor: pointer; text-align: start; }
    button.chip:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
    .chip .spot { color: var(--secondary-text-color); }
    .pop { position: absolute; z-index: 5; top: 100%; left: 0; width: max-content; max-width: min(280px, 80vw); padding: 8px 10px; border-radius: 8px;
      background: var(--card-background-color); color: var(--primary-text-color); border: 1px solid var(--divider-color);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25); font-size: 12px; line-height: 1.5; }
    .pop b { display: block; font-size: 13px; margin-bottom: 2px; }
    .pop .k { color: var(--secondary-text-color); margin-right: 4px; }
    .pop ul { margin: 0; padding-left: 16px; }
    /* A phone has no room beside a chip: the details sit at the bottom of the screen instead. */
    @media (max-width: 600px) { .pop { position: fixed; top: auto; left: 16px; right: 16px; bottom: 16px; max-width: none; width: auto; } }
  `];

  _close() { this._open = null; this._pinned = false; }

  _show(key, thing, pin) {
    if (pin) {
      if (this._open === key && this._pinned) return this._close();
      this._pinned = true;
    } else if (this._pinned) return;
    if (this._open === key) return;
    this._open = key;
  }

  /** The receivers' readings for the thing speaking for an open popup: fetched on first show and
   *  again at most every 10 s while it stays open (render runs on every state change). */
  _readingsFor(thing) {
    const e = this._readings[thing];
    if (this.hass && (!e || (!e.loading && Date.now() - e.at > 10000))) {
      this._readings[thing] = { ...e, loading: true };
      this.hass.callWS({ type: "sextant/thing/readings", entity: thing })
        .then((res) => res, () => null)     // an error reads as "no receiver right now"
        .then((res) => { this._readings[thing] = { at: Date.now(), res, loading: false }; this.requestUpdate(); });
    }
    return this._readings[thing];
  }

  _chip(r, name, icon, label = name) {
    const d = chipDetail(this.hass?.states, name, r.ids);
    const key = `${r.floor}|${r.room}|${name}`;
    const spot = d?.spot && d.room === r.room ? d.spot : null;
    const bt = d && (d.source === "ble" || d.source === "held") ? d.thing : null;
    return html`<span class="who"
        @pointerenter=${(e) => { if (e.pointerType === "mouse") this._show(key, bt, false); }}
        @pointerleave=${(e) => { if (e.pointerType === "mouse" && !this._pinned && this._open === key) this._close(); }}>
      <button class="chip" aria-expanded=${this._open === key} @click=${() => this._show(key, bt, true)}>
        <ha-icon icon=${icon}></ha-icon>${label}${spot ? html`<span class="spot">&nbsp;· ${spot}</span>` : nothing}</button>
      ${this._open === key ? this._pop(name, d, bt) : nothing}
    </span>`;
  }

  _pop(name, d, bt) {
    if (!d) return html`<div class="pop" role="tooltip"><b>${name}</b>No Sextant location sensor found.</div>`;
    const row = (k, v) => (v == null || v === "" ? nothing : html`<div><span class="k">${k}</span>${v}</div>`);
    const age = d.heardAt ? fmtAge((Date.now() - d.heardAt) / 1000) + " ago" : null;
    let src = WHERE_SOURCE[d.source] || d.source;
    if (d.source === "wifi" && d.accessPoint) src += ` (${d.accessPoint})`;
    if (d.source === "gps" && d.gpsAccuracy != null) src += ` (±${fmtLen(d.gpsAccuracy, this.hass, 0)})`;
    const rd = bt ? this._readingsFor(bt) : null;
    const waiting = rd && !("res" in rd);
    // Under 5 cm (or Bermuda's -1) is "no reading" to the solver too.
    const heard = (rd?.res?.receivers || []).filter((x) => Number.isFinite(x.distance) && x.distance >= 0.05 && !x.stale).sort((a, b) => a.distance - b.distance);
    return html`<div class="pop" role="tooltip"><b>${name}</b>
      ${row("Room", d.room && d.room !== "unknown" ? d.room : "Unknown")}
      ${row("Spot", d.spot)}
      ${row("Floor", d.floor && d.floor !== "unknown" ? d.floor : null)}
      ${row("Confidence", d.conf != null ? `${Math.round(d.conf * 100)}%` : null)}
      ${row("Last heard", age ? `${age}${d.presence ? ` (${d.presence})` : ""}` : d.presence)}
      ${row("Source", src)}
      ${bt ? html`<div><span class="k">Heard by</span>${waiting ? "…" : heard.length ? nothing : "no receiver right now"}</div>
        ${heard.length ? html`<ul>${heard.slice(0, 8).map((x) => html`<li>${proxyName(this.data, x.receiver)} · ${fmtLen(x.distance, this.hass)}</li>`)}${heard.length > 8 ? html`<li>${heard.length - 8} more</li>` : nothing}</ul>` : nothing}` : nothing}
    </div>`;
  }

  render() {
    const floors = this._floors || [];
    if (!floors.length) return html`<div class="empty">No room sensors yet. Draw rooms in Edit.</div>`;
    const people = new Set(floors.flatMap((f) => f.rooms.flatMap((r) => r.people))).size;
    return html`${[...floors, ...(this._outside ? [this._outside] : [])].map((f) => html`
      <div class="floor">
        <div class="fh"><b>${f.name}</b>
          <span class="pill ${f.people ? "on" : ""}">${f.people} ${f.people === 1 ? "person" : "people"}</span>
          ${f.pets ? html`<span class="pill">${f.pets} ${f.pets === 1 ? "pet" : "pets"}</span>` : nothing}</div>
        <div class="grid">${f.rooms.map((r) => html`
          <div class="room ${r.on ? (r.peopleOn ? "on" : "pets") : ""}">
            ${f === this._outside ? nothing : html`<div class="rn">${r.room}</div>`}
            ${r.people.map((p) => this._chip(r, p, "mdi:account", firstName(p)))}
            ${r.pets.map((p) => this._chip(r, p, "mdi:paw"))}
            ${r.on && r.sources.length ? html`<div class="src">${r.sources.map((x) => html`<ha-icon icon=${SOURCE_ICON[x] || "mdi:help-circle-outline"} title=${SOURCE_LABEL[x] || x}></ha-icon>`)}</div>` : nothing}
          </div>`)}</div>
      </div>`)}
      <div class="foot">${people} ${people === 1 ? "person" : "people"} in the house</div>`;
  }
}
if (!customElements.get("sextant-occupancy")) customElements.define("sextant-occupancy", SextantOccupancy);
