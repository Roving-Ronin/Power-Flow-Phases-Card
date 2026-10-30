/*
 * Power Flow Phases Card for Home Assistant
 * https://github.com/Roving-Ronin/Power-Flow-Phases-Card
 * ----------------------------------------
 * Core flow (solar / battery / grid / home) in the style of power-flow-card-plus,
 * with:
 *   - per-phase grid power/energy branching off the LEFT of the grid node
 *   - per-phase house load -> circuits -> individual loads branching off the RIGHT of the home node
 *
 * Single file, no external dependencies.
 *   type: custom:power-flow-phases-card   (legacy alias: custom:phase-power-flow-card)
 */

const PPFC_VERSION = '0.9.0';

// AU red / white / blue; L2 follows the theme text colour (white-ish on dark themes, black-ish on light)
const PPFC_PHASE_COLORS = ['#e53935', 'var(--primary-text-color, #212121)', '#1e88e5'];

const PPFC_STYLE = `
  :host { display: block; }
  ha-card { position: relative; padding: 12px 8px 14px; overflow: hidden; }
  .ver { position: absolute; right: 10px; bottom: 4px; font-size: 0.7em; color: var(--secondary-text-color); opacity: .7; pointer-events: none; }
  .header { font-size: 1.15em; font-weight: 500; padding: 0 8px 8px; color: var(--primary-text-color); }
  .note { font-size: 0.8em; color: var(--warning-color, #ffa600); padding: 0 8px 6px; }
  .scroll { position: relative; overflow-x: auto; overflow-y: hidden; padding: 4px 4px 8px; }
  .wrap {
    position: relative; display: flex; align-items: center; gap: 40px;
    width: max-content; margin: 0 auto; padding: 4px 6px; transform-origin: 0 0;
  }
  svg.lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: visible; }
  svg.lines path.ln { fill: none; stroke-width: 2; opacity: 0.85; transition: opacity .4s; }
  svg.lines path.ln.idle { opacity: 0.14; }
  svg.lines .dots.idle { display: none; }

  /* ---------- core ---------- */
  .core {
    position: relative; z-index: 1;
    display: grid; grid-template-columns: 140px 140px 140px; column-gap: 56px; row-gap: 34px; padding: 22px 0;
    align-items: center; justify-items: center;
  }
  .cnode { position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; }
  .cnode.hidden { visibility: hidden; pointer-events: none; }
  .cnode .label { position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%); white-space: nowrap; font-size: 0.95em; color: var(--secondary-text-color); line-height: 1.1; }
  .cnode.battery .label { bottom: auto; top: calc(100% + 4px); }
  .cnode.solar   { grid-row: 2; grid-column: 2; }
  .cnode.grid    { grid-row: 3; grid-column: 1; }
  .cnode.home    { grid-row: 3; grid-column: 3; }
  .cnode.inverter { grid-row: 3; grid-column: 2; }
  .cnode.battery { grid-row: 4; grid-column: 2; }
  .core.has-inv { column-gap: 84px; row-gap: 48px; }
  .strings { grid-row: 1; grid-column: 1 / 4; display: flex; gap: 14px; justify-content: center; }
  .strings:empty { display: none; }
  .tnode.lvl-string { width: 150px; }
  .cnode.inverter .label { display: none; }
  .cnode.inverter .circle { border-radius: 16px; }
  .cnode.inverter .circle ha-icon { --mdc-icon-size: 22px; margin-bottom: 0; }
  .circle .inm { font-size: 0.78em; font-weight: 500; color: var(--secondary-text-color); letter-spacing: .03em; }
  .core.has-strings .cnode.solar .label { visibility: hidden; }
  .circle {
    width: 126px; height: 126px; box-sizing: border-box; border-radius: 50%;
    border: 3px solid var(--c); background: var(--card-background-color, var(--ha-card-background, #fff));
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; line-height: 1.15; color: var(--primary-text-color);
  }
  .circle ha-icon { --mdc-icon-size: 32px; color: var(--c); margin-bottom: 1px; }
  .circle .pw { font-size: 1.3em; font-weight: 500; white-space: nowrap; }
  .circle .sub { font-size: 0.82em; color: var(--secondary-text-color); white-space: nowrap; }
  .circle .s2, .circle .s3 { font-size: 0.74em; }
  .home .circle {
    border-color: transparent;
    background:
      linear-gradient(var(--card-background-color, var(--ha-card-background, #fff)), var(--card-background-color, var(--ha-card-background, #fff))) padding-box,
      var(--ring, var(--c)) border-box;
  }

  /* ---------- tree / phase nodes ---------- */
  .gphases { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 10px; align-self: flex-start; }
  .tree { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 14px; }
  .pgroup, .crow { display: flex; flex-direction: row; align-items: center; gap: 36px; }
  .children { display: flex; flex-direction: column; gap: 6px; }
  .tnode {
    box-sizing: border-box; display: flex; align-items: center; gap: 6px;
    padding: 5px 8px 5px 7px; border-radius: 8px;
    border: 1px solid var(--divider-color, rgba(127,127,127,.3));
    border-left: 4px solid var(--c);
    background: var(--card-background-color, var(--ha-card-background, #fff));
    color: var(--primary-text-color); cursor: pointer; min-height: 40px;
  }
  .tnode { position: relative; transition: transform .15s ease, box-shadow .15s ease; }
  .tnode.zoom { transform: scale(var(--hover-scale, 1.5)); z-index: 10; box-shadow: 0 6px 18px rgba(0,0,0,.35); }
  .tnode.lvl-phase   { width: 248px; }
  .tnode .det { margin-top: 2px; padding-top: 2px; border-top: 1px solid var(--divider-color, rgba(127,127,127,.3)); font-size: 0.7em; color: var(--secondary-text-color); white-space: nowrap; line-height: 1.3; }
  .tnode .det:empty { display: none; }
  .tnode .det b { font-weight: 500; color: var(--primary-text-color); }
  .tnode .en::before { content: '| '; opacity: .6; }
  .tnode .en:empty::before { content: none; }
  .tnode.offline { opacity: .5; }
  .tnode .offl { font-size: 0.85em; font-weight: 500; color: var(--secondary-text-color); letter-spacing: .02em; }
  .wrap.has-hdr { padding-top: 42px; }
  .colhdr { position: absolute; top: 6px; z-index: 1; font-size: 1.3em; font-weight: 500; text-decoration: underline; text-underline-offset: 4px; color: var(--ppfc-header-color, var(--primary-color, #03a9f4)); white-space: nowrap; pointer-events: none; }
  .tnode.lvl-gphase  { width: 156px; }
  .tnode.lvl-circuit { width: 200px; }
  .tnode.lvl-load    { width: 200px; min-height: 34px; padding-top: 3px; padding-bottom: 3px; }
  .tnode.unmeasured  { border-style: dashed; border-left-style: solid; cursor: default; opacity: .85; }
  .tnode.unmeasured.small { opacity: .45; }
  .tnode.warn        { border-color: var(--error-color, #db4437); }
  .tnode ha-icon { --mdc-icon-size: 20px; color: var(--c); flex: 0 0 auto; }
  .tnode.lvl-load ha-icon { --mdc-icon-size: 18px; }
  .tnode .txt { flex: 1 1 auto; min-width: 0; line-height: 1.15; }
  .tnode .nm { font-size: 0.8em; color: var(--secondary-text-color); white-space: nowrap; display: flex; align-items: center; gap: 4px; min-width: 0; }
  .tnode .nmt { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .tnode .vals { display: flex; flex-wrap: wrap; column-gap: 6px; row-gap: 0; align-items: baseline; white-space: nowrap; }
  .tnode .pw { font-size: 0.9em; font-weight: 500; }
  .tnode .en { font-size: 0.72em; color: var(--secondary-text-color); }
  .tnode .chev {
    flex: 0 0 auto; border: 0; background: transparent; color: var(--secondary-text-color);
    cursor: pointer; padding: 0 2px; font-size: 0.95em; line-height: 1;
  }
  .tnode .chev .cnt { font-size: 0.7em; vertical-align: super; }
  .tnode .src { font-size: 0.78em; padding: 0 4px; border-radius: 6px; border: 1px solid currentColor; opacity: .75; flex: 0 0 auto; }
  .tnode .src-unknown { color: var(--warning-color, #ffa600); opacity: 1; }
  .imp { color: var(--energy-grid-consumption-color, #488fc2); }
  .exp { color: var(--energy-grid-return-color, #8353d1); }
  .calc { font-style: italic; }
  .warnmark { color: var(--error-color, #db4437); }
`;

/* ---------------------------------------------------------------- helpers */

function ppfcNorm(spec) {
  if (!spec) return null;
  if (typeof spec === 'string' || Array.isArray(spec)) return { power: spec };
  return { ...spec };
}

function ppfcSum(arr) {
  let s = 0, any = false;
  for (const x of arr) if (x !== null && x !== undefined && !Number.isNaN(x)) { s += x; any = true; }
  return any ? s : null;
}

function ppfcEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/* ---------------------------------------------------------------- card */

class PhasePowerFlowCard extends HTMLElement {
  /** Card picker default: everything from the Energy dashboard, phases added later in YAML. */
  static getStubConfig() {
    return { title: 'Power Flow', energy_dashboard: true };
  }

  setConfig(config) {
    if (!config || typeof config !== 'object') throw new Error('Invalid configuration');
    if (!config.energy_dashboard && (!config.entities || !config.entities.grid)) {
      throw new Error('entities.grid is required (or set energy_dashboard: true)');
    }
    this._config = {
      title: config.title,
      show_unmeasured: config.show_unmeasured !== false,
      unmeasured_threshold: Number(config.unmeasured_threshold ?? 20),
      show_loads: config.show_loads !== false,
      show_grid_phases: config.show_grid_phases !== false,
      max_power: Number(config.max_power ?? 10000),
      min_speed: Number(config.min_speed ?? 20),
      max_speed: Number(config.max_speed ?? 160),
      idle_threshold: Number(config.idle_threshold ?? 5),
      watt_threshold: Number(config.watt_threshold ?? 1000),
      kw_decimals: Number(config.kw_decimals ?? 2),
      kwh_decimals: Number(config.kwh_decimals ?? 1),
      entities: config.entities || {},
      energy_dashboard: !!config.energy_dashboard,
      energy_dashboard_devices: config.energy_dashboard_devices !== false,
      devices: Array.isArray(config.devices) ? config.devices : [],
      phases: Array.isArray(config.phases) ? config.phases : [],
      circuits: Array.isArray(config.circuits) ? config.circuits : [],
      show_unknown: config.show_unknown !== false,
      unknown_name: config.unknown_name || 'Unknown',
      unknown_color: config.unknown_color || '#9e9e9e',
      show_phase_source: config.show_phase_source !== false,
      detect_circuit_numbers: config.detect_circuit_numbers !== false,
      fit: ['screen', 'width', 'none'].includes(config.fit) ? config.fit : 'screen',
      max_height: config.max_height ? Number(config.max_height) : null,
      height_offset: Number(config.height_offset ?? 140),
      min_scale: Math.min(1, Math.max(0.2, Number(config.min_scale ?? 0.5))),
      energy_period: config.energy_period === 'state' ? 'state' : 'today',
      stats_interval: Math.max(60, Number(config.stats_interval ?? 300)),
      detail_kwh_decimals: Number(config.detail_kwh_decimals ?? 2),
      strip_prefixes: Array.isArray(config.strip_prefixes) ? config.strip_prefixes : ['Circuit - ', 'Circuit -', 'Circuit '],
      column_headers: config.column_headers !== false,
      header_color: config.header_color || null,
      show_version: config.show_version !== false,
      column_titles: { phases: 'Phases', circuits: 'Circuits', loads: 'Devices / Loads', ...(config.column_titles || {}) },
      show_offline: config.show_offline !== false,
      offline_name: config.offline_name || 'Offline',
      offline_when_zero: config.offline_when_zero !== false,
    };
    this._collapsed = new Map();
    this._ed = { state: 'idle', prefs: null, error: null };
    this._model = this._buildModel(this._mergedConfig());
    this._built = false;
    if (this._hass) { this._loadEnergyPrefs(); this._build(); this._update(); }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    this._loadEnergyPrefs();
    if (!this._built) this._build();
    this._update();
    if (!this._statsTimer && this._config.energy_period === 'today') this._startStats();
  }

  /* ------------------------------------------------------------ today's energy from recorder statistics */

  _startStats() {
    this._stopStats();
    this._refreshStats();
    this._statsTimer = setInterval(() => this._refreshStats(), this._config.stats_interval * 1000);
  }

  _stopStats() {
    if (this._statsTimer) clearInterval(this._statsTimer);
    this._statsTimer = null;
  }

  /** Every energy entity the current model displays. */
  _energyEntities() {
    const out = new Set();
    const add = (x) => [].concat(x || []).forEach((e) => typeof e === 'string' && out.add(e));
    const m = this._model; if (!m) return [];
    const c = m.core;
    add(c.solar?.energy); add(c.grid?.energy_import); add(c.grid?.energy_export);
    add(c.battery?.energy_charge); add(c.battery?.energy_discharge); add(c.home?.energy);
    add(c.inverter?.energy); (c.strings || []).forEach((st) => add(st.energy));
    const walk = (n) => {
      add(n.energy);
      if (n.grid) { add(n.grid.energy); add(n.grid.energy_import); add(n.grid.energy_export); }
      if (n.inverter) add(n.inverter.energy);
      n.children.forEach(walk);
    };
    m.phases.forEach(walk);
    return [...out];
  }

  /** "change" since local midnight for each energy entity, the same figure the Energy dashboard shows for Today. */
  _refreshStats() {
    if (!this._hass || !this._hass.callWS || this._config.energy_period !== 'today') return;
    const ids = this._energyEntities();
    if (!ids.length) return;
    const gen = (this._statsGen = (this._statsGen || 0) + 1);
    Promise.all(ids.map((id) => this._hass.callWS({
      type: 'recorder/statistic_during_period', statistic_id: id,
      calendar: { period: 'day' }, types: ['change'], units: { energy: 'kWh' },
    }).then((r) => [id, r && typeof r.change === 'number' ? r.change : null]).catch(() => [id, null])))
      .then((pairs) => {
        if (gen !== this._statsGen) return; // a newer refresh superseded this one
        this._stats = new Map(pairs.filter(([, v]) => v !== null));
        this._update();
      });
  }

  /* ------------------------------------------------------------ energy dashboard */

  _loadEnergyPrefs() {
    if (!this._config.energy_dashboard || this._ed.state !== 'idle' || !this._hass || !this._hass.callWS) return;
    this._ed.state = 'loading';
    this._hass.callWS({ type: 'energy/get_prefs' }).then((prefs) => {
      this._ed = { state: 'done', prefs, error: null };
      this._rebuild();
    }).catch((err) => {
      this._ed = { state: 'error', prefs: null, error: (err && (err.message || err.code)) || String(err) };
      this._rebuild();
    });
  }

  _rebuild() {
    this._model = this._buildModel(this._mergedConfig());
    if (this._hass) { this._build(); this._update(); this._refreshStats(); }
  }

  /** Power entities (and device tree) from the Energy dashboard preferences. HA convention: grid + = import, battery + = discharge. */
  _fromPrefs(prefs) {
    const out = { solar: [], battery: [], soc: null, grid: [], devices: prefs.device_consumption || [] };
    for (const src of prefs.energy_sources || []) {
      if (src.type === 'grid') {
        if (Array.isArray(src.flow_from)) { // legacy layout
          for (const pw of src.power || []) if (pw.stat_rate) out.grid.push(pw.stat_rate);
        } else if (src.stat_rate) out.grid.push(src.stat_rate);
      } else if (src.type === 'solar') {
        if (src.stat_rate) out.solar.push(src.stat_rate);
      } else if (src.type === 'battery') {
        if (src.stat_rate) out.battery.push(src.stat_rate);
        if (src.stat_soc && !out.soc) out.soc = src.stat_soc;
      }
    }
    return out;
  }

  _friendly(entityId) {
    const st = entityId && this._hass && this._hass.states[entityId];
    return (st && st.attributes && st.attributes.friendly_name) || entityId;
  }

  /** YAML config with Energy dashboard data filled in where YAML is silent. YAML always wins. */
  _mergedConfig() {
    const cfg = this._config;
    if (!cfg.energy_dashboard || this._ed.state !== 'done' || !this._ed.prefs) return cfg;
    const ed = this._fromPrefs(this._ed.prefs);
    const one = (arr) => (arr.length === 1 ? arr[0] : arr);
    const ents = { ...cfg.entities };
    const fill = (key, list, altKeys) => {
      const cur = ppfcNorm(ents[key]);
      if (cur && (cur.power || altKeys.some((k) => cur[k]))) return; // YAML already defines power
      if (!list.length) return;
      ents[key] = { ...(cur || {}), power: one(list), invert: false, _ed: true };
    };
    fill('grid', ed.grid, ['power_import', 'power_export']);
    fill('solar', ed.solar, []);
    fill('battery', ed.battery, ['power_charge', 'power_discharge']);
    if (ents.battery && ed.soc && !ppfcNorm(ents.battery).soc) ents.battery = { ...ppfcNorm(ents.battery), soc: ed.soc };
    if (!ents.grid) ents.grid = {};

    let circuits = cfg.circuits;
    let phases = cfg.phases;
    if (cfg.energy_dashboard_devices && ed.devices.length) {
      // entities already used by YAML circuits/phases -> those devices (and their subtree) are skipped
      const used = new Set();
      const collect = (spec) => {
        for (const k of ['power', 'energy']) [].concat(spec[k] || []).forEach((x) => used.add(x));
        (spec.loads || []).forEach(collect);
      };
      cfg.circuits.forEach(collect);
      cfg.phases.forEach((ph) => (ph.circuits || []).forEach(collect));

      const ovr = (dev) => cfg.devices.find((o) => o.entity && (o.entity === dev.stat_consumption || o.entity === dev.stat_rate)) || {};
      const statSet = new Set(ed.devices.map((d) => d.stat_consumption));
      const kids = new Map();
      for (const d of ed.devices) {
        const parent = d.included_in_stat && statSet.has(d.included_in_stat) ? d.included_in_stat : null;
        if (!kids.has(parent)) kids.set(parent, []);
        kids.get(parent).push(d);
      }
      const seen = new Set();
      const toSpec = (d) => {
        if (seen.has(d.stat_consumption)) return null; // guard against cycles
        seen.add(d.stat_consumption);
        const o = ovr(d);
        if (o.exclude || used.has(d.stat_consumption) || (d.stat_rate && used.has(d.stat_rate))) return null;
        return {
          name: o.name || d.name || this._friendly(d.stat_rate || d.stat_consumption),
          icon: o.icon, phase: o.phase, collapsed: o.collapsed,
          power: d.stat_rate, _stat: d.stat_consumption, _ed: true,
          energy: o.energy || (cfg.energy_period === 'today' ? d.stat_consumption : undefined),
          loads: (kids.get(d.stat_consumption) || []).map(toSpec).filter(Boolean),
        };
      };
      const roots = (kids.get(null) || []).map(toSpec).filter(Boolean);

      // A device that measures the same thing as Home or a phase is merged into that box instead of
      // becoming a circuit: matched by the YAML power/energy entity, or an explicit `device:` entity.
      const keysOf = (spec) => {
        const n = ppfcNorm(spec) || {};
        return new Set([].concat(n.power || [], n.energy || [], n.device || []).filter((x) => typeof x === 'string'));
      };
      const homeKeys = keysOf(cfg.entities.home);
      const phaseKeys = cfg.phases.slice(0, 3).map((ph) => {
        const k = keysOf(ph.load);
        [].concat(ph.device || []).forEach((x) => k.add(x));
        return k;
      });
      const hits = (keys, d) => (d.power && keys.has(d.power)) || (d._stat && keys.has(d._stat));
      const merged = cfg.phases.slice(0, 3).map(() => []);
      const expand = (d) => {
        if (hits(homeKeys, d)) return (d.loads || []).flatMap(expand); // Home device: its children are top level
        const i = phaseKeys.findIndex((k) => hits(k, d));
        if (i >= 0) { merged[i].push(...(d.loads || [])); return []; }
        return [d];
      };
      const topLevel = roots.flatMap(expand);
      circuits = [...cfg.circuits, ...topLevel];
      phases = cfg.phases.map((ph, i) => (i < 3 && merged[i].length
        ? { ...ph, circuits: [...(ph.circuits || []), ...merged[i].map((c) => ({ ...c, _mergedFrom: true }))] }
        : ph));
    }
    return { ...cfg, entities: ents, circuits, phases };
  }

  getCardSize() {
    const leaves = this._model ? this._model.leafCount : 3;
    return Math.max(5, Math.ceil(leaves * 0.9) + 2);
  }

  connectedCallback() {
    if (this._wrap && this._ro) { this._ro.observe(this._wrap); this._ro.observe(this._scroll); }
    if (this._hass && this._config && this._config.energy_period === 'today' && !this._statsTimer) this._startStats();
    if (!this._onWinResize) this._onWinResize = () => this._scheduleFit();
    window.addEventListener('resize', this._onWinResize);
  }

  disconnectedCallback() {
    this._stopStats();
    if (this._ro) this._ro.disconnect();
    if (this._onWinResize) window.removeEventListener('resize', this._onWinResize);
  }

  _scheduleFit() {
    if (this._fitQueued) return;
    this._fitQueued = true;
    requestAnimationFrame(() => { this._fitQueued = false; this._fit(); this._layout(); });
  }

  /** Scale the whole diagram (nodes + lines) to fit the card width and, for fit: screen, the visible height. */
  _fit() {
    const c = this._config, wrap = this._wrap, sc = this._scroll;
    if (!wrap || !sc) return;
    if (c.fit === 'none') {
      wrap.style.transform = ''; wrap.style.marginLeft = ''; sc.style.height = ''; sc.style.overflowX = '';
      this._scale = 1;
      this._hoverScale = 1.4;
      wrap.style.setProperty('--hover-scale', '1.4');
      return;
    }
    const natW = wrap.offsetWidth, natH = wrap.offsetHeight;
    const cs = getComputedStyle(sc);
    const availW = sc.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (!natW || !natH || availW <= 0) return;
    let s = availW / natW;
    if (c.fit === 'screen') {
      const maxH = c.max_height || Math.max(240, window.innerHeight - c.height_offset);
      s = Math.min(s, maxH / natH);
    }
    s = Math.min(1, Math.max(c.min_scale, s));
    const x = Math.max(0, (availW - natW * s) / 2);
    wrap.style.marginLeft = '0';
    wrap.style.transform = `translate(${x.toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
    sc.style.height = `${Math.ceil(natH * s + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom))}px`;
    sc.style.overflowX = natW * s > availW + 1 ? 'auto' : 'hidden';
    this._scale = s;
    // zoomed box ends up at least ~115% of its natural size on screen
    this._hoverScale = Math.min(2.5, Math.max(1.4, 1.15 / s));
    wrap.style.setProperty('--hover-scale', this._hoverScale.toFixed(3));
  }

  /* ------------------------------------------------------------ model */

  /** Manual phase value -> 0/1/2, -1 (unknown) or null (not set / unrecognised) */
  _parsePhase(v) {
    if (v === null || v === undefined || v === '') return null;
    const t = String(v).trim().toLowerCase();
    if (['a', 'l1', '1', 'phase a', 'phase_a'].includes(t)) return 0;
    if (['b', 'l2', '2', 'phase b', 'phase_b'].includes(t)) return 1;
    if (['c', 'l3', '3', 'phase c', 'phase_c'].includes(t)) return 2;
    if (['unknown', 'l0', '0', '?', 'none'].includes(t)) return -1;
    return null;
  }

  /**
   * Detect phase from the power entity id(s), then the name. Returns 0/1/2, -1 (explicitly unknown), or null (no match).
   *   1. whole word phase_a|phase_b|phase_c|l1|l2|l3
   *   2. power_<n><a|b|c>            e.g. circuit_power_3a_gpo, "Power 2C - Study"
   *   3. power_<n><l1|l2|l3|l0|lx|x>  e.g. circuit_power_6l1_workbench, power_4x (unknown)
   */
  _detectPhase(ci) {
    const ents = [].concat(ci.power || [], ci._stat || []).filter(Boolean).map((x) => String(x).split('.').pop());
    const strs = [...ents, ci.name || ''];
    const S = '[_\\s-]';
    const rePhase = new RegExp(`(?:^|${S})(?:phase${S}?([abc])|l([123]))(?=${S}|$)`, 'i');
    const reNumAbc = new RegExp(`(?:^|${S})power${S}?\\d+${S}?([abc])(?=${S}|$)`, 'i');
    const reNumL = new RegExp(`(?:^|${S})power${S}?\\d+${S}?(l[0-3]|lx|x)(?=${S}|$)`, 'i');
    for (const str of strs) {
      const m = rePhase.exec(str);
      if (m) return m[1] ? 'abc'.indexOf(m[1].toLowerCase()) : Number(m[2]) - 1;
    }
    if (this._config.detect_circuit_numbers) {
      for (const str of strs) {
        const m = reNumAbc.exec(str);
        if (m) return 'abc'.indexOf(m[1].toLowerCase());
      }
      for (const str of strs) {
        const m = reNumL.exec(str);
        if (m) {
          const t = m[1].toLowerCase();
          return ['l1', 'l2', 'l3'].includes(t) ? Number(t[1]) - 1 : -1;
        }
      }
    }
    return null;
  }

  /** PV strings from a {count, power: '...{n}...', ...} template or an explicit list; hides missing / never-used strings. */
  _stringSpecs(cfg) {
    if (!cfg) return [];
    if (Array.isArray(cfg)) return cfg.map((st, i) => ({ name: st.name || `PV${i + 1}`, ...st }));
    const n = Math.max(0, Math.min(16, Number(cfg.count ?? 4)));
    const sub = (t, i) => (typeof t === 'string' ? t.replace(/\{n\}/g, String(i)) : undefined);
    const out = [];
    for (let i = 1; i <= n; i++) {
      out.push({
        name: (cfg.name ? sub(cfg.name, i) : null) || `PV${i}`,
        power: sub(cfg.power, i), voltage: sub(cfg.voltage, i), current: sub(cfg.current, i),
        energy: sub(cfg.energy, i), total: sub(cfg.total, i),
      });
    }
    return out;
  }

  _stringVisible(st) {
    if (!this._hass) return true;
    if (!st.power || !this._hass.states[st.power]) return false;      // disabled / missing entity
    if (!this._avail(st.power)) return false;
    if (st.total && this._hass.states[st.total]) {
      const t = this._num(st.total);
      if (t !== null && t <= 0) return false;                          // never produced anything = not connected
    }
    return true;
  }

  _resolveStrings(cfg) {
    const all = this._stringSpecs(cfg);
    this._stringSig = all.map((st) => (this._stringVisible(st) ? 1 : 0)).join('');
    this._allStrings = all;
    return all.filter((st) => this._stringVisible(st)).map((st, i) => ({ ...st, id: `s${i}` }));
  }

  _cleanName(name) {
    if (!name) return name;
    let n = String(name);
    for (const pre of this._config.strip_prefixes || []) {
      if (pre && n.toLowerCase().startsWith(String(pre).toLowerCase()) && n.length > pre.length) { n = n.slice(pre.length); break; }
    }
    return n.trim();
  }

  _buildModel(cfg) {
    const e = cfg.entities || {};
    const core = {
      solar: ppfcNorm(e.solar),
      battery: ppfcNorm(e.battery),
      grid: ppfcNorm(e.grid) || {},
      home: ppfcNorm(e.home) || {},
      inverter: ppfcNorm(e.inverter),
    };
    core.strings = this._resolveStrings(core.solar && core.solar.strings);
    const index = new Map();
    const other = (parentId, name, depth) => ({
      id: `${parentId}u`, depth, level: depth === 1 ? 'circuit' : 'load', unmeasured: true,
      name: name || 'Other', icon: 'mdi:help-circle-outline', children: [],
    });

    /** spec -> node, recursing into spec.loads to any depth */
    const makeNode = (spec, id, depth, source) => {
      const kidSpecs = cfg.show_loads ? (spec.loads || []) : [];
      const node = {
        id, depth, level: depth === 1 ? 'circuit' : 'load',
        name: this._cleanName(spec.name) || (depth === 1 ? 'Circuit' : 'Load'),
        icon: spec.icon || (depth === 1 ? 'mdi:electric-switch' : 'mdi:power-plug'),
        power: spec.power, energy: spec.energy, invert: !!spec.invert,
        collapsedDefault: !!spec.collapsed, phaseSource: source, fromED: !!spec._ed,
        children: [],
      };
      node.children = kidSpecs.map((ks, k) => makeNode(ks, `${id}n${k}`, depth + 1, null));
      if (cfg.show_unmeasured && spec.power && node.children.length) node.children.push(other(id, spec.unmeasured_name, depth + 1));
      index.set(id, node);
      return node;
    };

    // resolve top-level circuits (YAML + Energy dashboard roots) to a phase: manual > detected > unknown
    const nPh = Math.min(3, cfg.phases.length);
    const buckets = [[], [], [], [], []]; // 0..2 phases, 3 unknown, 4 offline
    for (const ci of cfg.circuits) {
      let idx = this._parsePhase(ci.phase);
      let src = 'manual';
      if (idx === null) {
        const d = this._detectPhase(ci);
        idx = d === null ? -1 : d;
        src = idx >= 0 ? 'auto' : 'unknown';
      } else if (idx < 0) src = 'unknown';
      if (idx >= nPh) { idx = -1; src = 'unknown'; }
      buckets[idx < 0 ? 3 : idx].push({ ci, src });
    }
    // devices with no phase that are unavailable / idle go to Offline rather than Unknown
    this._unknownSpecs = buckets[3].map((b) => b.ci);
    if (cfg.show_offline) {
      const keep = [];
      for (const b of buckets[3]) (this._specOffline(b.ci) ? buckets[4] : keep).push(b);
      buckets[3] = keep;
    }
    this._offlineSig = this._unknownSpecs.map((ci) => (this._specOffline(ci) ? 1 : 0)).join('');

    const phases = cfg.phases.slice(0, 3).map((ph, i) => {
      const pid = `p${i}`;
      const load = ppfcNorm(ph.load) || {};
      const node = {
        id: pid, depth: 0, level: 'phase', name: ph.name || `Phase ${'ABC'[i]} (L${i + 1})`, icon: 'mdi:sine-wave',
        color: ph.color || PPFC_PHASE_COLORS[i % 3],
        power: load.power, energy: load.energy, invert: !!load.invert,
        grid: ppfcNorm(ph.grid), gridInvert: !!(ph.grid && ph.grid.invert),
        inverter: ppfcNorm(ph.inverter), collapsedDefault: !!ph.collapsed, children: [],
      };
      const specs = [...(ph.circuits || []).map((ci) => ({ ci, src: ci._mergedFrom ? 'upstream' : 'nested' })), ...buckets[i]];
      node.children = specs.map(({ ci, src }, j) => makeNode(ci, `${pid}c${j}`, 1, src));
      if (cfg.show_unmeasured && load.power && node.children.length) node.children.push(other(pid, ph.unmeasured_name, 1));
      index.set(pid, node);
      return node;
    });

    if (cfg.show_unknown && buckets[3].length) {
      const pid = 'px';
      const node = {
        id: pid, depth: 0, level: 'phase', name: cfg.unknown_name, icon: 'mdi:help-circle-outline',
        color: cfg.unknown_color, unknown: true, grid: null, gridInvert: false, collapsedDefault: false, children: [],
      };
      node.children = buckets[3].map(({ ci, src }, j) => makeNode(ci, `${pid}c${j}`, 1, src));
      index.set(pid, node);
      phases.push(node);
    }
    if (cfg.show_offline && buckets[4].length) {
      const pid = 'po';
      const node = {
        id: pid, depth: 0, level: 'phase', name: cfg.offline_name, icon: 'mdi:power-plug-off-outline',
        color: '#757575', unknown: true, offlineGroup: true, grid: null, gridInvert: false, collapsedDefault: false, children: [],
      };
      node.children = buckets[4].map(({ ci }, j) => makeNode(ci, `${pid}c${j}`, 1, null));
      index.set(pid, node);
      phases.push(node);
    }

    const leaves = (n) => (n.children.length ? n.children.reduce((a, k) => a + leaves(k), 0) : 1);
    const leafCount = phases.reduce((a, p) => a + leaves(p), 0);
    return { core, phases, index, leafCount: Math.max(leafCount, 3) };
  }

  /* ------------------------------------------------------------ state readers */

  _num(entityId) {
    if (!entityId || !this._hass) return null;
    const st = this._hass.states[entityId];
    if (!st) return null;
    const v = parseFloat(st.state);
    return Number.isFinite(v) ? v : null;
  }

  /** true when at least one of the entities currently reports a usable state */
  _avail(entityId) {
    if (Array.isArray(entityId)) return entityId.some((x) => this._avail(x));
    const st = entityId && this._hass && this._hass.states[entityId];
    return !!st && !['unavailable', 'unknown', ''].includes(st.state);
  }

  /** A top-level device counts as offline when it (and everything under it) is unavailable or idle. */
  _specOffline(spec) {
    if (!this._hass || !this._config.show_offline) return false;
    const idle = this._config.idle_threshold;
    const quiet = (sp) => {
      if (sp.power) {
        if (this._avail(sp.power)) {
          if (!this._config.offline_when_zero) return false;
          const w = this._power(sp.power);
          if (w !== null && Math.abs(w) > idle) return false;
        }
      } else if (!(sp.loads || []).length) return false; // nothing to judge by
      return (sp.loads || []).every(quiet);
    };
    return quiet(spec);
  }

  /** Looks like a sensor that resets each day (utility meter / *_daily / *_today) rather than a lifetime total */
  _isPeriodic(entityId) {
    const st = entityId && this._hass && this._hass.states[entityId];
    if (st && st.attributes && (st.attributes.last_reset || st.attributes.meter_period)) return true;
    return /(^|[._])(daily|today|day)($|_)/i.test(String(entityId));
  }

  _unit(entityId) {
    const st = entityId && this._hass && this._hass.states[entityId];
    return (st && st.attributes && st.attributes.unit_of_measurement) || '';
  }

  /** Power in W */
  _power(entityId) {
    if (Array.isArray(entityId)) return ppfcSum(entityId.map((x) => this._power(x)));
    const v = this._num(entityId);
    if (v === null) return null;
    const u = this._unit(entityId).toLowerCase();
    if (u === 'kw') return v * 1000;
    if (u === 'mw') return v * 1e6;
    return v;
  }

  /** Energy in kWh */
  _energy(entityId) {
    if (Array.isArray(entityId)) return ppfcSum(entityId.map((x) => this._energy(x)));
    if (this._config.energy_period === 'today') {
      if (this._stats && this._stats.has(entityId)) return this._stats.get(entityId);
      // no statistic (yet): only trust the raw state if it is itself a daily figure, never a lifetime total
      if (!this._isPeriodic(entityId)) return null;
    }
    const v = this._num(entityId);
    if (v === null) return null;
    const u = this._unit(entityId).toLowerCase();
    if (u === 'wh') return v / 1000;
    if (u === 'mwh') return v * 1000;
    return v;
  }

  _fmtP(w, abs = true) {
    if (w === null || w === undefined) return '—';
    const x = abs ? Math.abs(w) : w;
    if (Math.abs(x) >= this._config.watt_threshold) return `${(x / 1000).toFixed(this._config.kw_decimals)} kW`;
    return `${Math.round(x)} W`;
  }

  _fmtE(kwh) {
    if (kwh === null || kwh === undefined) return '';
    return `${kwh.toFixed(this._config.kwh_decimals)} kWh`;
  }

  _isCollapsed(node) {
    return this._collapsed.has(node.id) ? this._collapsed.get(node.id) : !!node.collapsedDefault;
  }

  /* ------------------------------------------------------------ build DOM */

  _build() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const m = this._model;
    const cfg = this._config;
    const core = m.core;

    const coreNode = (key, label, icon, color, hidden) => `
      <div class="cnode ${key} ${hidden ? 'hidden' : ''}" data-node="${key}" title="${ppfcEsc(label)}" style="--c:${color}">
        <div class="label">${ppfcEsc(label)}</div>
        <div class="circle">
          <ha-icon icon="${icon}"></ha-icon>
          ${key === 'inverter' ? `<span class="inm">${ppfcEsc(label)}</span>` : ''}
          <span class="pw"></span>
          <span class="sub s1"></span>
          <span class="sub s2"></span>
          <span class="sub s3"></span>
        </div>
      </div>`;

    const tnode = (n, level, color, extraCls = '') => {
      const kids = (n.children || []).length;
      const SRC = { auto: ['auto', 'Phase detected from entity name'], manual: ['set', 'Phase set in config'], unknown: ['?', 'Phase not known yet'], upstream: ['up', 'Phase from its Energy dashboard upstream device'] };
      const srcTag = cfg.show_phase_source && SRC[n.phaseSource]
        ? `<span class="src src-${n.phaseSource}" title="${SRC[n.phaseSource][1]}">${SRC[n.phaseSource][0]}</span>` : '';
      const chev = kids ? `<button class="chev" data-toggle="${n.id}">${this._isCollapsed(n) ? `▸<span class="cnt">${kids}</span>` : '▾'}</button>` : '';
      return `
        <div class="tnode lvl-${level} ${n.unmeasured ? 'unmeasured' : ''} ${extraCls}" data-node="${n.id}" data-depth="${n.depth ?? ''}" style="--c:${color}">
          <ha-icon icon="${n.icon || 'mdi:sine-wave'}"></ha-icon>
          <div class="txt">
            <div class="nm" title="${ppfcEsc(n.name)}"><span class="nmt">${ppfcEsc(n.name)}</span>${srcTag}</div>
            <div class="vals"><span class="pw"></span><span class="en"></span></div>
            ${level === 'phase' || level === 'gphase' || level === 'string' ? '<div class="det"></div>' : ''}
          </div>
          ${chev}
        </div>`;
    };

    const gridPhases = cfg.show_grid_phases ? m.phases.filter((p) => p.grid) : [];
    const gphHtml = gridPhases.length
      ? `<div class="gphases">${gridPhases.map((p) => tnode({ id: `g${p.id}`, name: p.name, icon: 'mdi:sine-wave' }, 'gphase', p.color)).join('')}</div>`
      : '';

    const branch = (n, color, cls) => {
      const kids = this._isCollapsed(n) ? '' : n.children.map((k) => branch(k, color, 'crow')).join('');
      return `<div class="${cls}">${tnode(n, n.level, color)}${kids ? `<div class="children">${kids}</div>` : ''}</div>`;
    };
    const treeHtml = m.phases.length
      ? `<div class="tree">${m.phases.map((p) => branch(p, p.color, 'pgroup')).join('')}</div>`
      : '';

    const hdrHtml = cfg.column_headers && m.phases.length
      ? ['phases', 'circuits', 'loads'].map((k, i) => `<div class="colhdr" data-col="${i}">${ppfcEsc(cfg.column_titles[k])}</div>`).join('')
      : '';

    let note = '';
    if (cfg.energy_dashboard && this._ed.state === 'error') note = `Energy dashboard settings could not be loaded: ${ppfcEsc(this._ed.error)}`;
    else if (cfg.energy_dashboard && this._ed.state === 'loading') note = 'Loading Energy dashboard settings…';

    this.shadowRoot.innerHTML = `
      <style>${PPFC_STYLE}</style>
      <ha-card>
        ${cfg.title ? `<div class="header">${ppfcEsc(cfg.title)}</div>` : ''}
        ${note ? `<div class="note">${note}</div>` : ''}
        <div class="scroll">
          <div class="wrap ${hdrHtml ? 'has-hdr' : ''}" ${cfg.header_color ? `style="--ppfc-header-color:${ppfcEsc(cfg.header_color)}"` : ''}>
            <svg class="lines" xmlns="http://www.w3.org/2000/svg"></svg>
            ${gphHtml}
            <div class="core ${core.inverter ? 'has-inv' : ''} ${(core.strings || []).length ? 'has-strings' : ''}">
              <div class="strings">${(core.strings || []).map((st) => tnode({ id: st.id, name: st.name, icon: 'mdi:solar-panel' }, 'string', 'var(--energy-solar-color, #ff9800)')).join('')}</div>
              ${core.inverter ? coreNode('inverter', core.inverter.name || 'Inverter', core.inverter.icon || 'mdi:sine-wave', 'var(--ppfc-inverter-color, #78909c)', false) : ''}
              ${coreNode('solar', core.solar?.name || 'Solar', core.solar?.icon || 'mdi:solar-power', 'var(--energy-solar-color, #ff9800)', !core.solar)}
              ${coreNode('grid', core.grid?.name || 'Grid', core.grid?.icon || 'mdi:transmission-tower', 'var(--energy-grid-consumption-color, #488fc2)', false)}
              ${coreNode('home', core.home?.name || 'Home', core.home?.icon || 'mdi:home', 'var(--primary-text-color)', false)}
              ${coreNode('battery', core.battery?.name || 'Battery', core.battery?.icon || 'mdi:battery', 'var(--energy-battery-out-color, #4db6ac)', !core.battery)}
            </div>
            ${treeHtml}
            ${hdrHtml}
          </div>
        </div>
        ${cfg.show_version ? `<div class="ver">v${PPFC_VERSION}</div>` : ''}
      </ha-card>`;

    const root = this.shadowRoot;
    this._wrap = root.querySelector('.wrap');
    this._gphOffset = 0;
    this._scroll = root.querySelector('.scroll');
    this._svg = root.querySelector('svg.lines');

    // element registry
    this._els = {};
    root.querySelectorAll('[data-node]').forEach((el) => {
      const id = el.dataset.node;
      this._els[id] = {
        root: el,
        anchor: el.querySelector('.circle') || el,
        pw: el.querySelector('.pw'),
        en: el.querySelector('.en'),
        s1: el.querySelector('.s1'),
        s2: el.querySelector('.s2'),
        s3: el.querySelector('.s3'),
        icon: el.querySelector('ha-icon'),
        det: el.querySelector('.det'),
      };
      el.addEventListener('click', () => this._moreInfo(id));
      if (el.classList.contains('tnode')) {
        el.addEventListener('mouseenter', () => this._zoom(el, true));
        el.addEventListener('mouseleave', () => this._zoom(el, false));
      }
    });
    root.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = btn.dataset.toggle;
        const node = this._findNode(id);
        this._collapsed.set(id, !this._isCollapsed(node));
        this._build();
        this._update();
      });
    });

    this._buildLinks(gridPhases);

    if (!this._ro) this._ro = new ResizeObserver(() => this._scheduleFit());
    this._ro.disconnect();
    this._ro.observe(this._wrap);
    this._ro.observe(this._scroll);
    this._built = true;
    requestAnimationFrame(() => { this._fit(); this._layout(); this._applyFlows(); });
  }

  /** Hover-zoom a box; grow away from the diagram edges so it isn't clipped. */
  _zoom(el, on) {
    if (!on) { el.classList.remove('zoom'); return; }
    const hs = this._hoverScale || 1.4;
    const wr = this._wrap.getBoundingClientRect(), r = el.getBoundingClientRect();
    const gw = r.width * (hs - 1), gh = r.height * (hs - 1);
    const ox = r.right + gw > wr.right ? 'right' : 'left';
    let oy = 'center';
    if (r.top - gh / 2 < wr.top) oy = 'top';
    else if (r.bottom + gh / 2 > wr.bottom) oy = 'bottom';
    el.style.transformOrigin = `${ox} ${oy}`;
    el.classList.add('zoom');
  }

  _findNode(id) {
    return (this._model.index && this._model.index.get(id)) || { id };
  }

  _moreInfo(id) {
    let ent = this._entityFor(id);
    if (Array.isArray(ent)) ent = ent[0];
    if (!ent) return;
    this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: ent }, bubbles: true, composed: true }));
  }

  _entityFor(id) {
    const c = this._model.core;
    if (id === 'solar') return c.solar?.power || c.solar?.energy;
    if (id === 'battery') return c.battery?.power || c.battery?.soc || c.battery?.power_charge;
    if (id === 'grid') return c.grid?.power || c.grid?.power_import;
    if (id === 'home') return c.home?.power || c.home?.energy;
    if (id === 'inverter') return c.inverter?.power || c.inverter?.energy;
    const st = (c.strings || []).find((x) => x.id === id);
    if (st) return st.power || st.energy;
    for (const p of this._model.phases) {
      if (id === `g${p.id}`) return p.grid?.power || p.grid?.energy;
    }
    const n = this._model.index.get(id);
    if (n) return n.power || n.energy;
    return null;
  }

  /* ------------------------------------------------------------ links */

  _buildLinks(gridPhases) {
    const m = this._model;
    const L = [];
    const solarC = 'var(--energy-solar-color, #ff9800)';
    const gridC = 'var(--energy-grid-consumption-color, #488fc2)';
    const battC = 'var(--energy-battery-out-color, #4db6ac)';
    if (m.core.inverter) {
      // hybrid inverter in the middle: DC side (solar, battery) and AC side (home, grid) both pass through it
      if (m.core.solar) L.push({ key: 'x:solarInv', core: 'solarInv', color: solarC });
      if (m.core.battery) L.push({ key: 'x:invBatt', core: 'invBatt', color: battC });
      L.push({ key: 'x:invHome', core: 'invHome', color: solarC, dyn: 'home' });
      L.push({ key: 'x:invGrid', core: 'invGrid', color: 'var(--energy-grid-return-color, #8353d1)', dyn: 'grid' });
    } else {
      if (m.core.solar) {
        L.push({ key: 'f:solarHome', core: 'solarHome', color: solarC });
        L.push({ key: 'f:solarGrid', core: 'solarGrid', color: solarC });
        if (m.core.battery) L.push({ key: 'f:solarBattery', core: 'solarBattery', color: solarC });
      }
      if (m.core.battery) {
        L.push({ key: 'f:batteryHome', core: 'batteryHome', color: battC });
        L.push({ key: 'f:gridBattery', core: 'gridBattery', color: gridC });
      }
      L.push({ key: 'f:gridHome', core: 'gridHome', color: gridC });
    }
    // PV strings -> solar circle (top)
    (m.core.strings || []).forEach((st, i, arr) => {
      L.push({ key: `s:${st.id}`, from: st.id, to: 'solar', vertical: true, toOff: (i - (arr.length - 1) / 2) * 14, color: solarC });
    });

    // grid phases -> grid circle (forward = import)
    gridPhases.forEach((p, i) => {
      L.push({ key: `g:${p.id}`, from: `g${p.id}`, to: 'grid', fromOff: 0, toOff: (i - (gridPhases.length - 1) / 2) * 14, color: p.color });
    });

    // home -> phases -> circuits -> loads (any depth)
    const n = m.phases.length;
    const walk = (node, color) => {
      if (this._isCollapsed(node)) return;
      for (const k of node.children) {
        L.push({ key: `n:${k.id}`, from: node.id, to: k.id, fromOff: 0, toOff: 0, color, dashed: !!k.unmeasured });
        walk(k, color);
      }
    };
    m.phases.forEach((p, i) => {
      L.push({ key: `n:${p.id}`, from: 'home', to: p.id, fromOff: (i - (n - 1) / 2) * 14, toOff: 0, color: p.color, dashed: !!p.unknown });
      walk(p, p.color);
    });

    const NS = 'http://www.w3.org/2000/svg';
    this._svg.innerHTML = '';
    for (const lk of L) {
      const g = document.createElementNS(NS, 'g');
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('class', 'ln idle');
      path.style.stroke = lk.color;
      if (lk.dashed) path.setAttribute('stroke-dasharray', '4 4');
      g.appendChild(path);
      const dots = document.createElementNS(NS, 'g');
      dots.setAttribute('class', 'dots idle');
      const anims = [];
      for (let k = 0; k < 2; k++) {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('r', '3.2');
        c.style.fill = lk.color;
        const am = document.createElementNS(NS, 'animateMotion');
        am.setAttribute('dur', '3s');
        am.setAttribute('repeatCount', 'indefinite');
        am.setAttribute('calcMode', 'linear');
        am.setAttribute('keyTimes', '0;1');
        am.setAttribute('keyPoints', '0;1');
        c.appendChild(am);
        dots.appendChild(c);
        anims.push(am);
      }
      g.appendChild(dots);
      this._svg.appendChild(g);
      lk.path = path; lk.dots = dots; lk.anims = anims; lk.len = 0; lk.dur = null; lk.dir = null;
    }
    this._links = L;
  }

  _rect(id, base) {
    const e = this._els[id];
    if (!e) return null;
    const r = e.anchor.getBoundingClientRect();
    const k = this._scale || 1; // getBoundingClientRect is post-transform; SVG lives in unscaled space
    const l = (r.left - base.left) / k, t = (r.top - base.top) / k, w = r.width / k, h = r.height / k;
    return { l, t, r: l + w, b: t + h, cx: l + w / 2, cy: t + h / 2 };
  }

  _layout() {
    if (!this._wrap || !this._links) return;
    const base = this._wrap.getBoundingClientRect();
    if (!base.width) return;
    // grid phases: middle of the column level with the grid circle (Phase B at 9 o'clock, A above, C below)
    const gph = this._wrap.querySelector('.gphases');
    const gEl = this._els.grid && this._els.grid.anchor;
    if (gph && gEl) {
      const k = this._scale || 1;
      const gr = gEl.getBoundingClientRect(), pr = gph.getBoundingClientRect();
      const delta = ((gr.top + gr.height / 2) - (pr.top + pr.height / 2)) / k;
      if (Math.abs(delta) > 0.5) {
        this._gphOffset = (this._gphOffset || 0) + delta;
        gph.style.marginTop = `${Math.max(0, this._gphOffset).toFixed(1)}px`;
      }
    }
    this._svg.setAttribute('viewBox', `0 0 ${this._wrap.offsetWidth} ${this._wrap.offsetHeight}`);
    const S = this._rect('solar', base), G = this._rect('grid', base), B = this._rect('battery', base), H = this._rect('home', base);
    const I = this._rect('inverter', base);
    const f = (x) => x.toFixed(1);
    const o = 10;
    for (const lk of this._links) {
      let d = null;
      if (lk.core) {
        switch (lk.core) {
          case 'solarHome':    d = `M${f(S.cx + o)},${f(S.b)} Q${f(S.cx + o)},${f(H.cy - o)} ${f(H.l)},${f(H.cy - o)}`; break;
          case 'solarGrid':    d = `M${f(S.cx - o)},${f(S.b)} Q${f(S.cx - o)},${f(G.cy - o)} ${f(G.r)},${f(G.cy - o)}`; break;
          case 'solarBattery': d = `M${f(S.cx)},${f(S.b)} L${f(B.cx)},${f(B.t)}`; break;
          case 'batteryHome':  d = `M${f(B.cx + o)},${f(B.t)} Q${f(B.cx + o)},${f(H.cy + o)} ${f(H.l)},${f(H.cy + o)}`; break;
          case 'gridBattery':  d = `M${f(G.r)},${f(G.cy + o)} Q${f(B.cx - o)},${f(G.cy + o)} ${f(B.cx - o)},${f(B.t)}`; break;
          case 'gridHome':     d = `M${f(G.r)},${f(G.cy)} L${f(H.l)},${f(H.cy)}`; break;
          case 'solarInv':     d = `M${f(S.cx)},${f(S.b)} L${f(I.cx)},${f(I.t)}`; break;
          case 'invBatt':      d = `M${f(I.cx)},${f(I.b)} L${f(B.cx)},${f(B.t)}`; break;
          case 'invHome':      d = `M${f(I.r)},${f(I.cy)} L${f(H.l)},${f(H.cy)}`; break;
          case 'invGrid':      d = `M${f(I.l)},${f(I.cy)} L${f(G.r)},${f(G.cy)}`; break;
          case 'gridHomeArc': {
            // grid -> home passes below the inverter, between it and the battery
            const y0 = G.cy + 16, y1 = H.cy + 16, mid = (I.b + B.t) / 2;
            const c = 2 * mid - (y0 + y1) / 2;
            d = `M${f(G.r - 4)},${f(y0)} Q${f(I.cx)},${f(c)} ${f(H.l + 4)},${f(y1)}`;
            break;
          }
        }
      } else if (lk.vertical) {
        const A = this._rect(lk.from, base), Z = this._rect(lk.to, base);
        if (!A || !Z) continue;
        const x1 = A.cx, y1 = A.b, x2 = Z.cx + (lk.toOff || 0), y2 = Z.t + 2;
        const my = (y1 + y2) / 2;
        d = `M${f(x1)},${f(y1)} C${f(x1)},${f(my)} ${f(x2)},${f(my)} ${f(x2)},${f(y2)}`;
      } else {
        const A = this._rect(lk.from, base), Z = this._rect(lk.to, base);
        if (!A || !Z) continue;
        const x1 = A.r, y1 = A.cy + lk.fromOff, x2 = Z.l, y2 = Z.cy + lk.toOff;
        const mx = (x1 + x2) / 2;
        d = `M${f(x1)},${f(y1)} C${f(mx)},${f(y1)} ${f(mx)},${f(y2)} ${f(x2)},${f(y2)}`;
      }
      if (!d) continue;
      lk.path.setAttribute('d', d);
      lk.anims.forEach((a) => a.setAttribute('path', d));
      try { lk.len = lk.path.getTotalLength(); } catch (_) { lk.len = 100; }
      lk.dur = null; // force re-timing
    }
    // column headers sit over the left edge of the first box at each depth (2 = all devices/loads)
    const hdrs = this._wrap.querySelectorAll('.colhdr');
    if (hdrs.length) {
      const minL = [Infinity, Infinity, Infinity];
      for (const [id, e] of Object.entries(this._els)) {
        const d = e.root.dataset ? e.root.dataset.depth : '';
        if (d === '' || d === undefined) continue;
        const col = Math.min(2, Number(d));
        const r = this._rect(id, base);
        if (r && r.l < minL[col]) minL[col] = r.l;
      }
      hdrs.forEach((h) => {
        const col = Number(h.dataset.col);
        if (Number.isFinite(minL[col])) { h.style.display = ''; h.style.left = `${minL[col].toFixed(1)}px`; }
        else h.style.display = 'none';
      });
    }
    this._applyFlows();
  }

  /* ------------------------------------------------------------ compute */

  _compute() {
    const m = this._model;
    const c = m.core;
    const v = {};

    // ---- core
    const solar = c.solar ? Math.max(0, this._power(c.solar.power) ?? 0) : 0;

    let grid = null;
    if (c.grid.power) grid = this._power(c.grid.power);
    else if (c.grid.power_import || c.grid.power_export) grid = (this._power(c.grid.power_import) ?? 0) - (this._power(c.grid.power_export) ?? 0);
    if (grid !== null && c.grid.invert) grid = -grid;
    const gridN = grid ?? 0;

    let batt = null; // + discharge, - charge
    if (c.battery) {
      if (c.battery.power) batt = this._power(c.battery.power);
      else if (c.battery.power_charge || c.battery.power_discharge) batt = (this._power(c.battery.power_discharge) ?? 0) - (this._power(c.battery.power_charge) ?? 0);
      if (batt !== null && c.battery.invert) batt = -batt;
    }
    const battN = batt ?? 0;

    const homeEnt = c.home.power ? this._power(c.home.power) : null;
    const homeCalc = Math.max(0, solar + gridN + battN);
    const home = homeEnt ?? homeCalc;

    // flow split (same approach as power-flow-card-plus)
    const gImp = Math.max(gridN, 0), gExp = Math.max(-gridN, 0);
    const bDis = Math.max(battN, 0), bChg = Math.max(-battN, 0);
    const solarGrid = Math.min(solar, gExp);
    const batteryGrid = Math.min(bDis, Math.max(0, gExp - solarGrid));
    const solarLeft = solar - solarGrid;
    const solarBattery = Math.min(solarLeft, bChg);
    const gridBattery = Math.min(gImp, Math.max(0, bChg - solarBattery));
    const solarHome = Math.max(0, solarLeft - solarBattery);
    const batteryHome = Math.max(0, bDis - batteryGrid);
    const gridHome = Math.max(0, gImp - gridBattery);

    v.flows = { solarHome, solarGrid, solarBattery, batteryHome, gridBattery: gridBattery - batteryGrid, gridHome };
    // hybrid-inverter routing (forward = solar->inv, inv->battery (charge), inv->home, inv->grid (export))
    v.xflows = {
      solarInv: solar,
      invBatt: -battN,
      invHome: solarHome + batteryHome + gridHome,
      invGrid: solarGrid + batteryGrid - gridBattery - gridHome,   // + export, - import
    };
    v.homeMix = { solar: solarHome, battery: batteryHome, grid: gridHome };
    v.gridMix = { solar: solarGrid, battery: batteryGrid, grid: gridBattery };
    // PV strings
    v.strings = {};
    let strSum = null;
    for (const st of c.strings || []) {
      const sp = this._power(st.power);
      v.strings[st.id] = {
        p: sp, e: st.energy ? this._energy(st.energy) : null,
        v: st.voltage ? this._num(st.voltage) : null, a: st.current ? this._num(st.current) : null,
      };
      if (sp !== null) strSum = (strSum ?? 0) + Math.max(0, sp);
    }
    v.pvLoss = strSum !== null && c.solar ? strSum - solar : null;
    // inverter
    if (c.inverter) {
      const ip = this._power(c.inverter.power);
      v.inverter = {
        p: ip !== null && c.inverter.invert ? -ip : ip,
        e: c.inverter.energy ? this._energy(c.inverter.energy) : null,
        dcBatt: solarBattery,
        // everything in minus everything out: inverter/BMS standby + conversion losses
        self: homeEnt !== null ? solar + bDis + gImp - bChg - gExp - homeEnt : null,
      };
    }
    v.core = {
      solar, grid, batt, home, homeCalc: homeEnt === null,
      soc: c.battery?.soc ? this._num(c.battery.soc) : null,
      solarE: c.solar?.energy ? this._energy(c.solar.energy) : null,
      gridImpE: c.grid.energy_import ? this._energy(c.grid.energy_import) : null,
      gridExpE: c.grid.energy_export ? this._energy(c.grid.energy_export) : null,
      battInE: c.battery?.energy_charge ? this._energy(c.battery.energy_charge) : null,
      battOutE: c.battery?.energy_discharge ? this._energy(c.battery.energy_discharge) : null,
      homeE: c.home.energy ? this._energy(c.home.energy) : null,
      supply: { solar: solarHome, battery: batteryHome, grid: gridHome },
    };

    // ---- tree (bottom-up, any depth)
    v.nodes = {};
    const thr = this._config.unmeasured_threshold;
    const evalNode = (n) => {
      const kids = n.children.filter((k) => !k.unmeasured);
      const kv = kids.map(evalNode);
      let p = n.power ? this._power(n.power) : null;
      if (p !== null && n.invert) p = -p;
      const e = n.energy ? this._energy(n.energy) : null;
      const val = { p, e, calc: false, offline: !!n.power && !this._avail(n.power) };
      const kp = ppfcSum(kv.map((x) => x.p));
      if (p === null && kv.length) { val.p = kp; val.calc = kp !== null; }
      const allE = kv.length && kv.every((x) => x.e !== null && x.e !== undefined);
      if (e === null && allE) { val.e = ppfcSum(kv.map((x) => x.e)); val.eCalc = true; }
      const u = n.children.find((k) => k.unmeasured);
      if (u) {
        const rem = p !== null ? p - (kp ?? 0) : null;
        const remE = e !== null && allE ? e - (ppfcSum(kv.map((x) => x.e)) ?? 0) : null;
        v.nodes[u.id] = { p: rem, e: remE, unmeasured: true, warn: rem !== null && rem < -thr, small: rem === null || Math.abs(rem) < thr };
      }
      if (n.inverter) {
        let ip = this._power(n.inverter.power);
        if (ip !== null && n.inverter.invert) ip = -ip;
        val.inv = {
          p: ip,
          e: n.inverter.energy ? this._energy(n.inverter.energy) : null,
          v: n.inverter.voltage ? this._num(n.inverter.voltage) : null,
          a: n.inverter.current ? this._num(n.inverter.current) : null,
        };
      }
      v.nodes[n.id] = val;
      return val;
    };
    for (const p of m.phases) {
      if (p.grid) {
        let gp = this._power(p.grid.power);
        if (gp !== null && p.gridInvert) gp = -gp;
        v.nodes[`g${p.id}`] = {
          p: gp,
          e: p.grid.energy ? this._energy(p.grid.energy) : null,
          eImp: p.grid.energy_import ? this._energy(p.grid.energy_import) : null,
          eExp: p.grid.energy_export ? this._energy(p.grid.energy_export) : null,
        };
      }
      evalNode(p);
    }
    return v;
  }

  /* ------------------------------------------------------------ update */

  _update() {
    if (!this._built || !this._hass) return;
    const v = this._compute();
    this._v = v;
    const E = this._els;
    const cv = v.core;

    // solar
    if (E.solar && this._model.core.solar) {
      E.solar.pw.textContent = this._fmtP(cv.solar);
      E.solar.s1.textContent = this._fmtE(cv.solarE);
      const loss = v.pvLoss;
      E.solar.s2.textContent = loss !== null && loss > this._config.idle_threshold ? `Losses: ≈${this._fmtP(loss)}` : '';
      E.solar.s2.title = 'PV strings total minus plant PV power (estimate)';
    }
    if (E.inverter && v.inverter) {
      const iv = v.inverter, idle = this._config.idle_threshold;
      E.inverter.pw.textContent = this._fmtP(iv.p);
      E.inverter.s1.textContent = this._fmtE(iv.e);
      E.inverter.s2.textContent = iv.dcBatt > idle ? `DC→Batt: ${this._fmtP(iv.dcBatt)}` : '';
      E.inverter.s2.title = 'Solar charging the battery directly on the DC side';
      E.inverter.s3.textContent = iv.self !== null && iv.self > idle ? `Self use: ≈${this._fmtP(iv.self)}` : '';
      E.inverter.s3.title = 'Self consumption: inverter/BMS standby + conversion losses (PV + discharge + import − charge − export − house)';
    }
    for (const st of this._model.core.strings || []) {
      const el = E[st.id], sv = v.strings[st.id];
      if (!el || !sv) continue;
      const dk = (x) => `${x.toFixed(this._config.detail_kwh_decimals)} kWh`;
      const lines = [];
      lines.push(`Power: <b>${this._fmtP(sv.p)}</b>`);
      if (sv.e !== null) lines.push(`Energy: <b>${dk(sv.e)}</b>`);
      if (sv.a !== null) lines.push(`Current: <b>${sv.a.toFixed(1)} A</b>`);
      if (sv.v !== null) lines.push(`Volts: <b>${Math.round(sv.v)} V</b>`);
      el.pw.textContent = ''; el.en.textContent = '';
      if (el.det) el.det.innerHTML = lines.join('<br>');
    }
    // grid
    if (E.grid) {
      const g = cv.grid;
      E.grid.pw.innerHTML = g === null ? '—' : `<span class="${g >= 0 ? 'imp' : 'exp'}">${g >= 0 ? '↓' : '↑'} ${this._fmtP(g)}</span>`;
      E.grid.s1.innerHTML = cv.gridImpE !== null ? `<span class="imp">↓</span> ${this._fmtE(cv.gridImpE)}` : '';
      E.grid.s2.innerHTML = cv.gridExpE !== null ? `<span class="exp">↑</span> ${this._fmtE(cv.gridExpE)}` : '';
      E.grid.root.style.setProperty('--c', g !== null && g < 0 ? 'var(--energy-grid-return-color, #8353d1)' : 'var(--energy-grid-consumption-color, #488fc2)');
    }
    // battery
    if (E.battery && this._model.core.battery) {
      const b = cv.batt;
      const soc = cv.soc;
      const charging = b !== null && b < -this._config.idle_threshold;
      E.battery.pw.textContent = soc !== null ? `${Math.round(soc)}%` : this._fmtP(b);
      E.battery.s1.textContent = b === null ? '' : (soc !== null ? `${charging ? '↓' : (b > this._config.idle_threshold ? '↑' : '')} ${this._fmtP(b)}` : '');
      const eParts = [];
      if (cv.battInE !== null) eParts.push(`↓${cv.battInE.toFixed(this._config.kwh_decimals)}`);
      if (cv.battOutE !== null) eParts.push(`↑${cv.battOutE.toFixed(this._config.kwh_decimals)}`);
      E.battery.s2.textContent = eParts.join(' ');
      E.battery.s2.title = eParts.length ? 'kWh charged / discharged' : '';
      if (!this._model.core.battery.icon && E.battery.icon) {
        let icon = 'mdi:battery';
        if (soc !== null) {
          const lvl = Math.round(soc / 10) * 10;
          if (charging) icon = lvl <= 0 ? 'mdi:battery-charging-outline' : `mdi:battery-charging-${Math.min(lvl, 100)}`;
          else icon = lvl <= 0 ? 'mdi:battery-outline' : (lvl >= 100 ? 'mdi:battery' : `mdi:battery-${lvl}`);
        }
        E.battery.icon.setAttribute('icon', icon);
      }
      E.battery.root.style.setProperty('--c', charging ? 'var(--energy-battery-in-color, #f06292)' : 'var(--energy-battery-out-color, #4db6ac)');
    }
    // home
    if (E.home) {
      E.home.pw.innerHTML = `<span class="${cv.homeCalc ? 'calc' : ''}">${this._fmtP(cv.home)}</span>`;
      E.home.s1.textContent = this._fmtE(cv.homeE);
      const s = cv.supply, tot = s.solar + s.battery + s.grid;
      if (tot > 0) {
        const a = (s.solar / tot) * 360, b = a + (s.battery / tot) * 360;
        E.home.root.style.setProperty('--ring', `conic-gradient(var(--energy-solar-color, #ff9800) 0deg ${a}deg, var(--energy-battery-out-color, #4db6ac) ${a}deg ${b}deg, var(--energy-grid-consumption-color, #488fc2) ${b}deg 360deg)`);
      } else {
        E.home.root.style.removeProperty('--ring');
      }
    }

    if (this._allStrings && this._allStrings.length) {
      const ssig = this._allStrings.map((st) => (this._stringVisible(st) ? 1 : 0)).join('');
      if (ssig !== this._stringSig) { this._rebuild(); return; }
    }

    // a top-level device went offline / came back: move it between Unknown and Offline
    if (this._config.show_offline && this._unknownSpecs && this._unknownSpecs.length) {
      const sig = this._unknownSpecs.map((ci) => (this._specOffline(ci) ? 1 : 0)).join('');
      if (sig !== this._offlineSig) { this._rebuild(); return; }
    }

    // tree nodes
    for (const [id, nv] of Object.entries(v.nodes)) {
      const el = E[id];
      if (!el) continue;
      const dk = (x) => `${x.toFixed(this._config.detail_kwh_decimals)} kWh`;
      if (id.startsWith('g')) {
        const p = nv.p;
        el.pw.innerHTML = p === null ? '—' : `<span class="${p >= 0 ? 'imp' : 'exp'}">${p >= 0 ? '↓' : '↑'} ${this._fmtP(p)}</span>`;
        el.en.textContent = '';
        const lines = [];
        if (nv.eImp !== null) lines.push(`Imported: <b>${dk(nv.eImp)}</b>`);
        if (nv.eExp !== null) lines.push(`Exported: <b>${dk(nv.eExp)}</b>`);
        if (!lines.length && nv.e !== null) lines.push(`Energy: <b>${dk(nv.e)}</b>`);
        if (el.det) el.det.innerHTML = lines.join('<br>');
        continue;
      }
      const isPhase = el.root.classList.contains('lvl-phase');
      el.root.classList.toggle('offline', !!nv.offline);
      if (nv.offline) {
        el.pw.innerHTML = `<span class="offl">${ppfcEsc(this._config.offline_name)}</span>`;
        el.en.innerHTML = '';
        if (el.det) el.det.innerHTML = '';
        el.root.classList.remove('warn', 'small');
        continue;
      }
      const warn = nv.warn ? '<span class="warnmark" title="Children report more than the parent meter">⚠ </span>' : '';
      el.pw.innerHTML = `${warn}<span class="${nv.calc ? 'calc' : ''}" ${nv.calc ? 'title="Sum of children"' : ''}>${nv.p !== null && nv.p < 0 ? '−' : ''}${this._fmtP(nv.p)}</span>`;
      const hasE = nv.e !== null && nv.e !== undefined;
      if (isPhase) {
        el.en.innerHTML = '';
        const lines = [];
        if (hasE) lines.push(`Energy: <b class="${nv.eCalc ? 'calc' : ''}">${dk(nv.e)}</b>`);
        const iv = nv.inv;
        const volts = iv && iv.v !== null ? iv.v : null;
        if (volts && nv.p !== null) lines.push(`Current: <b title="House load ÷ phase voltage">≈${(Math.abs(nv.p) / volts).toFixed(1)} A</b>`);
        if (volts) lines.push(`Volts: <b>${Math.round(volts)} V</b>`);
        if (iv && (iv.p !== null || iv.e !== null || iv.a !== null)) {
          const parts = [];
          if (iv.p !== null) parts.push(`${iv.p < 0 ? '−' : ''}${this._fmtP(iv.p)}`);
          if (iv.e !== null) parts.push(dk(iv.e));
          if (iv.a !== null) parts.push(`${iv.a.toFixed(1)} A`);
          lines.push(`Inverter: ${parts.join(' | ')}`);
        }
        if (el.det) el.det.innerHTML = lines.join('<br>');
      } else {
        el.en.innerHTML = hasE ? `<span class="${nv.eCalc ? 'calc' : ''}">${dk(nv.e)}</span>` : '';
      }
      el.root.classList.toggle('warn', !!nv.warn);
      el.root.classList.toggle('small', !!nv.small);
    }

    this._applyFlows();
  }

  _speed(w) {
    const c = this._config;
    const frac = Math.min(1, Math.log10(1 + Math.abs(w)) / Math.log10(1 + c.max_power));
    return c.min_speed + (c.max_speed - c.min_speed) * frac;
  }

  _applyFlows() {
    if (!this._links || !this._v) return;
    const v = this._v;
    const idle = this._config.idle_threshold;
    for (const lk of this._links) {
      let w = 0;
      const [kind, k] = lk.key.split(':');
      if (kind === 'f') w = v.flows[k] ?? 0;
      else if (kind === 'x') w = v.xflows?.[k] ?? 0;
      else if (kind === 's') w = v.strings?.[k]?.p ?? 0;
      else if (kind === 'g') w = v.nodes[`g${k}`]?.p ?? 0;
      else if (kind === 'n') {
        const nv = v.nodes[k];
        w = nv?.p ?? 0;
        if (nv?.unmeasured && nv.small) w = 0;
      }
      if (lk.dyn) {
        // colour the inverter's AC lines by what is mostly feeding them
        const mix = lk.dyn === 'home' ? v.homeMix : v.gridMix;
        let col;
        const gridCol = 'var(--energy-grid-consumption-color, #488fc2)';
        if (lk.dyn === 'grid' && w < 0) col = gridCol;
        else {
          const g = mix.grid && lk.dyn === 'home' ? mix.grid : 0;
          if (g > mix.solar && g > mix.battery) col = gridCol;
          else col = (mix.battery > mix.solar) ? 'var(--energy-battery-out-color, #4db6ac)' : 'var(--energy-solar-color, #ff9800)';
        }
        if (col !== lk.col) {
          lk.col = col; lk.path.style.stroke = col;
          lk.dots.querySelectorAll('circle').forEach((c) => { c.style.fill = col; });
        }
      }
      const active = Math.abs(w) > idle && lk.len > 0;
      lk.path.classList.toggle('idle', !active);
      lk.dots.classList.toggle('idle', !active);
      if (!active) continue;
      const dir = w >= 0 ? 1 : -1;
      if (dir !== lk.dir) {
        lk.anims.forEach((a) => a.setAttribute('keyPoints', dir > 0 ? '0;1' : '1;0'));
        lk.dir = dir;
      }
      const dur = Math.max(0.4, lk.len / this._speed(w));
      if (lk.dur === null || Math.abs(dur - lk.dur) / lk.dur > 0.15) {
        lk.anims.forEach((a, i) => {
          a.setAttribute('dur', `${dur.toFixed(2)}s`);
          a.setAttribute('begin', `${(-(dur * i) / lk.anims.length).toFixed(2)}s`);
        });
        lk.dur = dur;
      }
    }
  }
}

const PPFC_TAG = 'power-flow-phases-card';
const PPFC_LEGACY_TAG = 'phase-power-flow-card'; // name used before the card had its own repository

if (!customElements.get(PPFC_TAG)) {
  customElements.define(PPFC_TAG, PhasePowerFlowCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: PPFC_TAG,
    name: 'Power Flow Phases Card',
    description: 'Solar / battery / grid / home power flow with per-phase grid, an inverter centre, PV strings, and a phase → circuit → device drill-down.',
    preview: false,
    documentationURL: 'https://github.com/Roving-Ronin/Power-Flow-Phases-Card',
  });
  console.info(`%c POWER-FLOW-PHASES-CARD %c v${PPFC_VERSION} `, 'color:#fff;background:#e53935;font-weight:700', 'color:#e53935;background:#fff');
}
if (!customElements.get(PPFC_LEGACY_TAG)) {
  customElements.define(PPFC_LEGACY_TAG, class extends PhasePowerFlowCard {});
}
