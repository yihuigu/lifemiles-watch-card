/*
 * lifemiles-watch-card: shows what the LifeMiles award watcher found.
 *
 *   type: custom:lifemiles-watch-card
 *   entity: sensor.lifemiles_watch        # the status sensor described in the README
 *   title: LifeMiles award watch          # optional
 *   recent_days: 7                        # optional: how long a gone award counts as "recent"
 *   max_history: 10                       # optional: older finds listed under "History"
 *   max_runs: 5                           # optional: runs listed under "Recent runs"
 *   show_watches: true                    # optional: the "Watching" section (routes and dates)
 *
 * No build step and no dependencies. Colours come from the Home Assistant theme.
 */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const miles = (n) => Number(n).toLocaleString("en-US");
const dateRange = (a, b) =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" })
    .formatRange(new Date(`${a}T00:00:00`), new Date(`${b}T00:00:00`));
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const day = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
const stamp = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function span(ms) {
  const m = Math.round(Math.abs(ms) / 60000);
  if (m < 2) return "a moment";
  if (m < 120) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}
const took = (secs) => (secs < 90 ? `${secs} s` : `${Math.round(secs / 60)} min`);
const ago = (iso, now) => (now - new Date(iso) < 90000 ? "just now" : `${span(now - new Date(iso))} ago`);
const until = (iso, now) => (new Date(iso) - now < 90000 ? "any minute" : `in ${span(new Date(iso) - now)}`);

const STYLE = `
  :host { display: block; }
  ha-card { padding: 16px; overflow: hidden; }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .title { font-size: 1.25em; font-weight: 500; }
  .sub, .muted { color: var(--secondary-text-color); font-size: 0.85em; }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0 4px; }
  .tile { background: var(--secondary-background-color, rgba(127,127,127,.12)); border-radius: 10px; padding: 10px; }
  .tile .k { font-size: 0.75em; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .04em; }
  .tile .v { font-size: 1.15em; font-weight: 500; margin-top: 2px; }
  .tile.hit { background: rgba(67,160,71,.16); box-shadow: inset 0 0 0 2px var(--success-color, #43a047); }
  .tile.hit .v { font-size: 1.6em; color: var(--success-color, #43a047); line-height: 1.1; }
  .tile.bad .v { color: var(--error-color, #db4437); }
  h3 { margin: 16px 0 6px; font-size: 0.8em; font-weight: 500; text-transform: uppercase; letter-spacing: .05em;
       color: var(--secondary-text-color); }
  .row { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 8px 10px; margin: 6px 0;
         border-radius: 8px; border-left: 4px solid var(--divider-color, #888);
         background: var(--secondary-background-color, rgba(127,127,127,.1)); }
  .row.two { border-left-color: var(--success-color, #43a047); }
  .row.one { border-left-color: var(--warning-color, #ffa600); }
  .row.now.two { background: rgba(67,160,71,.16); }
  .row.now.one { background: rgba(255,166,0,.15); }
  .row.past { opacity: 0.72; }
  .when { font-weight: 500; }
  .price { text-align: right; font-weight: 500; white-space: nowrap; }
  .price small { font-weight: 400; color: var(--secondary-text-color); }
  .meta { grid-column: 1 / -1; color: var(--secondary-text-color); font-size: 0.8em; }
  .badge { display: inline-block; border-radius: 999px; padding: 1px 8px; font-size: 0.75em; font-weight: 500;
           color: #fff; vertical-align: 1px; margin-left: 6px; }
  .badge.two { background: var(--success-color, #43a047); }
  .badge.one { background: var(--warning-color, #ffa600); color: #1b1b1b; }
  .badge.new { background: var(--primary-color, #03a9f4); }
  .empty { padding: 10px 2px; color: var(--secondary-text-color); }
  details summary { cursor: pointer; padding: 6px 0; color: var(--secondary-text-color); font-size: 0.85em; }
  .strip { display: flex; gap: 3px; margin: 4px 0 8px; flex-wrap: wrap; }
  .strip i { width: 14px; height: 14px; border-radius: 3px; background: var(--divider-color, #999); }
  .strip i.found { background: var(--success-color, #43a047); }
  .strip i.bad { background: var(--error-color, #db4437); }
  .watch { display: flex; justify-content: space-between; gap: 8px; padding: 5px 0; font-size: 0.9em;
           border-bottom: 1px solid var(--divider-color, rgba(127,127,127,.25)); }
  .watch .r { font-weight: 500; }
  .watch .d { color: var(--secondary-text-color); text-align: right; white-space: nowrap; }
  .src { color: var(--secondary-text-color); font-size: 0.8em; padding-top: 4px; }
  .run { display: flex; justify-content: space-between; gap: 8px; font-size: 0.85em; padding: 3px 0;
         border-bottom: 1px solid var(--divider-color, rgba(127,127,127,.25)); }
  .run.bad { color: var(--error-color, #db4437); }
  .run .n { color: var(--secondary-text-color); text-align: right; }
  .run.bad .n { color: inherit; }
`;

class LifemilesWatchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  static getStubConfig() {
    return { entity: "sensor.lifemiles_watch" };
  }

  setConfig(config) {
    if (!config || !config.entity) throw new Error("lifemiles-watch-card: `entity` is required");
    this._config = { recent_days: 7, max_history: 10, max_runs: 5, show_watches: true, ...config };
    this._last = undefined;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const stateObj = hass.states[this._config.entity];
    if (stateObj !== this._last) {
      this._last = stateObj;
      this._render();
    }
  }

  getCardSize() {
    const a = (this._last && this._last.attributes) || {};
    return 4 + 2 * (a.current || []).length;
  }

  _render() {
    if (!this._config) return;
    const stateObj = this._last;
    let body;
    if (!stateObj) {
      body = `<div class="empty">Entity <code>${esc(this._config.entity)}</code> was not found.</div>`;
    } else if (["unavailable", "unknown"].includes(stateObj.state) || !stateObj.attributes.runs) {
      body = `<div class="empty">Waiting for the watcher: the sensor is ${esc(stateObj.state)}.
              Check that the app is running and the REST sensor can reach it.</div>`;
    } else {
      body = this._body(stateObj);
    }
    const title = this._config.title || "LifeMiles award watch";
    this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card>
      <div class="head"><div class="title">✈ ${esc(title)}</div>${this._sub(stateObj)}</div>${body}</ha-card>`;
  }

  _sub(stateObj) {
    const c = stateObj && stateObj.attributes && stateObj.attributes.config;
    if (!c) return "";
    const seats = c.min_seats ? `${c.min_seats}+ seat${c.min_seats === 1 ? "" : "s"}` : "";
    return `<div class="sub">Business · ${esc(seats)} · up to ${miles(c.max_miles_pp)} mi pp</div>`;
  }

  _body(stateObj) {
    const a = stateObj.attributes;
    const now = new Date();
    const current = a.current || [];
    const history = a.history || [];
    const runs = a.runs || [];
    const total = Number(stateObj.state) || current.length;
    const lastRun = runs[0];
    const cutoff = now - this._config.recent_days * 86400000;
    const recent = history.filter((h) => new Date(h.gone_at) >= cutoff);
    const older = history.filter((h) => new Date(h.gone_at) < cutoff).slice(0, this._config.max_history);

    const tiles = `<div class="tiles">
      <div class="tile ${total > 0 ? "hit" : ""}"><div class="k">Available now</div><div class="v">${total}</div></div>
      <div class="tile ${lastRun && !lastRun.ok ? "bad" : ""}"><div class="k">Last run</div>
        <div class="v">${a.last_run ? esc(ago(a.last_run, now)) : "never"}</div></div>
      <div class="tile"><div class="k">Next run</div>
        <div class="v">${a.next_run ? esc(until(a.next_run, now)) : "running"}</div></div></div>`;

    const nowRows = current.length
      ? current.map((o) => this._row(o, "now", now)).join("") +
        (total > current.length ? `<div class="muted">+ ${total - current.length} more not shown</div>` : "")
      : `<div class="empty">Nothing available right now.</div>`;

    const recentRows = recent.map((o) => this._row(o, "past", now)).join("");
    const olderRows = older.map((o) => this._row(o, "past", now)).join("");
    const strip = runs.slice(0, 14).reverse()
      .map((r) => `<i class="${!r.ok ? "bad" : r.found > 0 ? "found" : ""}" title="${esc(stamp(r.at))}: ${
        r.ok ? plural(r.found, "award") + " found" : "needs attention"}"></i>`).join("");
    const runRows = runs.slice(0, this._config.max_runs).map((r) => this._run(r)).join("");

    return `${tiles}
      <h3>Available now</h3>${nowRows}
      ${recentRows ? `<h3>Found in the last ${plural(this._config.recent_days, "day")}</h3>${recentRows}` : ""}
      ${olderRows ? `<details><summary>History (${older.length} earlier ${older.length === 1 ? "find" : "finds"})</summary>${olderRows}</details>` : ""}
      <h3>Recent runs</h3><div class="strip">${strip}</div>${runRows || '<div class="empty">No runs recorded yet.</div>'}
      ${this._watching(a)}`;
  }

  _watching(a) {
    const c = a.config || {};
    const list = c.watches || [];
    if (!this._config.show_watches || !list.length) return "";
    const rows = list.map((w) => `<div class="watch"><span class="r">${esc((w.from || []).join(", "))} → ${esc((w.to || []).join(", "))}</span>
      <span class="d">${esc(dateRange(w.start, w.end))}</span></div>`).join("");
    const src = c.source === "home-assistant" ? "Set in Home Assistant (replaces config.toml until reset)"
      : c.source === "config.toml" ? "From the watcher's config.toml" : "";
    return `<details><summary>Watching ${plural(list.length, "route block")}</summary>${rows}${src ? `<div class="src">${esc(src)}</div>` : ""}</details>`;
  }

  _row(o, kind, now) {
    const two = o.seats >= 2;
    const seatBadge = `<span class="badge ${two ? "two" : "one"}">${plural(o.seats, "seat")}</span>`;
    const fresh = kind === "now" && now - new Date(o.first_seen) < 86400000;
    const newBadge = fresh ? '<span class="badge new">NEW</span>' : "";
    let meta;
    if (kind === "now") {
      meta = `first seen ${esc(ago(o.first_seen, now))}`;
    } else {
      const lasted = span(new Date(o.gone_at) - new Date(o.first_seen));
      meta = `seen ${esc(stamp(o.first_seen))}, gone ${esc(ago(o.gone_at, now))} (lasted ${esc(lasted)})`;
    }
    const taxes = o.taxes_usd ? ` <small>+ US$${esc(o.taxes_usd)}</small>` : "";
    return `<div class="row ${kind} ${two ? "two" : "one"}">
      <div><span class="when">${esc(day(o.depart))}</span>${seatBadge}${newBadge}</div>
      <div class="price">${miles(o.miles_pp)} mi${taxes}</div>
      <div class="muted">${esc(o.origin)} → ${esc(o.dest)} · ${esc(String(o.flights).replace(/\+/g, " + "))}</div>
      <div class="meta">${meta}</div></div>`;
  }

  _run(r) {
    const result = !r.ok ? esc(r.note || "needs attention")
      : r.found > 0 ? plural(r.found, "award") : "nothing found";
    const detail = r.attempts
      ? `${plural(r.attempts, "search", "searches")}${r.errors ? `, ${plural(r.errors, "error")}` : ""}${r.secs >= 10 ? ` · ${took(r.secs)}` : ""}`
      : "";
    return `<div class="run ${r.ok ? "" : "bad"}"><span>${esc(stamp(r.at))} · ${result}</span><span class="n">${detail}</span></div>`;
  }
}

if (!customElements.get("lifemiles-watch-card")) {
  customElements.define("lifemiles-watch-card", LifemilesWatchCard);
}
window.customCards = window.customCards || [];
window.customCards.push({
  type: "lifemiles-watch-card",
  name: "LifeMiles award watch",
  description: "Recent runs and the award space the LifeMiles watcher found, now and before.",
});
