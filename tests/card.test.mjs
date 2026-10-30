// Unit tests for the card's pure logic. Run with: node --test tests/
// No dependencies: the card is loaded into a vm context with minimal DOM stubs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../dist/power-flow-phases-card.js', import.meta.url), 'utf8');

function loadCard() {
  const defined = new Map();
  const ctx = {
    console: { info() {}, log() {}, warn() {} },
    HTMLElement: class {},
    customElements: { get: (n) => defined.get(n), define: (n, c) => defined.set(n, c) },
    window: {},
    requestAnimationFrame: () => 0,
    setInterval: () => 0, clearInterval() {},
    ResizeObserver: class { observe() {} disconnect() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { Card: vm.runInContext('PhasePowerFlowCard', ctx), version: vm.runInContext('PPFC_VERSION', ctx), defined, ctx };
}

/** A card instance with config applied, without rendering. */
function cardWith(config = {}, states = {}) {
  const { Card } = loadCard();
  const c = new Card();
  c._built = true; // skip DOM building; _update() early-outs on missing elements
  c.setConfig({ entities: { grid: { power: 'sensor.grid' } }, ...config });
  c._hass = { states };
  return c;
}

const S = (state, unit) => ({ state: String(state), attributes: { unit_of_measurement: unit } });

test('registers the card and the legacy alias', () => {
  const { defined, ctx } = loadCard();
  assert.ok(defined.get('power-flow-phases-card'));
  assert.ok(defined.get('phase-power-flow-card'));
  assert.equal(ctx.window.customCards[0].type, 'power-flow-phases-card');
});

test('version looks like semver', () => {
  assert.match(loadCard().version, /^\d+\.\d+\.\d+/);
});

test('setConfig requires a grid unless energy_dashboard is on', () => {
  const { Card } = loadCard();
  assert.throws(() => new Card().setConfig({}), /entities\.grid is required/);
  assert.doesNotThrow(() => new Card().setConfig({ energy_dashboard: true }));
  assert.doesNotThrow(() => new Card().setConfig(Card.getStubConfig()));
});

test('phase detection from entity names', () => {
  const c = cardWith();
  const cases = [
    ['sensor.circuit_phase_b_network_rack_power', 1],
    ['sensor.hvac_phase_a_power', 0],
    ['sensor.load_l3_power', 2],
    ['sensor.circuit_power_3a_gpo_power', 0],
    ['sensor.circuit_power_7b_workbench_gpo_2_power', 1],
    ['sensor.circuit_power_8c_workbench_gpo_3_power', 2],
    ['sensor.circuit_power_6l1_workbench_power', 0],
    ['sensor.circuit_power_9l0_shed_power', -1],
    ['sensor.circuit_power_9x_shed_power', -1],
    ['sensor.circuit_power_8cworkbench_gpo_3_power', null], // no separator after the phase letter
    ['sensor.power_3am_timer', null],
    ['sensor.circuit_oven_power', null],
  ];
  for (const [entity, expected] of cases) assert.equal(c._detectPhase({ power: entity }), expected, entity);
  assert.equal(c._detectPhase({ power: 'sensor.x', name: 'Power 2C - Study' }), 2);
});

test('detect_circuit_numbers: false disables the power_<n><phase> patterns', () => {
  const c = cardWith({ detect_circuit_numbers: false });
  assert.equal(c._detectPhase({ power: 'sensor.circuit_power_3a_gpo_power' }), null);
  assert.equal(c._detectPhase({ power: 'sensor.hvac_phase_a_power' }), 0);
});

test('manual phase values', () => {
  const c = cardWith();
  for (const [v, e] of [['A', 0], ['l2', 1], ['3', 2], ['unknown', -1], ['L0', -1], ['', null], ['z', null]]) {
    assert.equal(c._parsePhase(v), e, String(v));
  }
});

test('name prefix stripping', () => {
  const c = cardWith();
  assert.equal(c._cleanName('Circuit - Power 3A'), 'Power 3A');
  assert.equal(c._cleanName('circuit - Oven'), 'Oven');
  assert.equal(c._cleanName('Kitchen Fridge'), 'Kitchen Fridge');
  assert.equal(cardWith({ strip_prefixes: [] })._cleanName('Circuit - Oven'), 'Circuit - Oven');
});

test('PV string template expands and hides missing / never-used strings', () => {
  const states = {
    'sensor.pv1_power': S(3.8, 'kW'), 'sensor.pv1_total': S(4.06, 'MWh'),
    'sensor.pv2_power': S(0, 'kW'), 'sensor.pv2_total': S(1.68, 'MWh'),   // 0 W at night: still shown
    'sensor.pv3_power': S(0, 'kW'), 'sensor.pv3_total': S(0, 'MWh'),      // never produced: hidden
    // pv4 entities don't exist (disabled): hidden
  };
  const c = cardWith({}, states);
  const shown = c._resolveStrings({ count: 4, power: 'sensor.pv{n}_power', total: 'sensor.pv{n}_total' });
  assert.deepEqual(Array.from(shown, (s) => s.name), ['PV1', 'PV2']);
});

test('power units are normalised to W and energy to kWh', () => {
  const c = cardWith({ energy_period: 'state' }, {
    'sensor.a': S(2.5, 'kW'), 'sensor.b': S(300, 'W'), 'sensor.c': S(1500, 'Wh'), 'sensor.d': S(1.2, 'MWh'),
  });
  assert.equal(c._power('sensor.a'), 2500);
  assert.equal(c._power(['sensor.a', 'sensor.b']), 2800);
  assert.equal(c._energy('sensor.c'), 1.5);
  assert.equal(c._energy('sensor.d'), 1200);
});

test('today mode never shows a lifetime total as today', () => {
  const c = cardWith({}, { 'sensor.meter_total': S(4219.5, 'kWh'), 'sensor.meter_daily': S(3.2, 'kWh') });
  assert.equal(c._energy('sensor.meter_total'), null);
  assert.equal(c._energy('sensor.meter_daily'), 3.2);
  c._stats = new Map([['sensor.meter_total', 2.4]]);
  assert.equal(c._energy('sensor.meter_total'), 2.4);
});

test('Other = parent minus children, with a warning when children exceed the parent', () => {
  const states = {
    'sensor.grid': S(0, 'W'),
    'sensor.circuit': S(700, 'W'), 'sensor.dev1': S(450, 'W'), 'sensor.dev2': S(300, 'W'),
  };
  const c = cardWith({
    unmeasured_threshold: 20,
    phases: [{ name: 'A', load: 'sensor.circuit' }],
    circuits: [{ name: 'Rack', phase: 'A', power: 'sensor.circuit', loads: [{ name: 'D1', power: 'sensor.dev1' }, { name: 'D2', power: 'sensor.dev2' }] }],
  }, states);
  const v = c._compute();
  const rack = c._model.phases[0].children[0];
  const other = v.nodes[rack.children.find((k) => k.unmeasured).id];
  assert.equal(other.p, -50);
  assert.equal(other.warn, true);
});

test('battery and grid sign handling, and hybrid-inverter flows', () => {
  const states = {
    'sensor.pv': S(5000, 'W'), 'sensor.grid': S(-2000, 'W'),     // exporting 2 kW
    'sensor.batt': S(1000, 'W'),                                   // Sigen style: + = charging
    'sensor.home': S(2000, 'W'), 'sensor.inv': S(4000, 'W'),
  };
  const c = cardWith({
    entities: {
      solar: { power: 'sensor.pv' }, grid: { power: 'sensor.grid' },
      battery: { power: 'sensor.batt', invert: true }, home: { power: 'sensor.home' },
      inverter: { power: 'sensor.inv' },
    },
  }, states);
  const v = c._compute();
  assert.equal(v.core.batt, -1000);          // normalised: - = charging
  assert.equal(v.xflows.solarInv, 5000);
  assert.equal(v.xflows.invBatt, 1000);      // inverter -> battery (charging)
  assert.equal(v.xflows.invHome, 2000);
  assert.equal(v.xflows.invGrid, 2000);      // + = export
  assert.equal(v.inverter.dcBatt, 1000);     // solar charging the battery on the DC side
});
