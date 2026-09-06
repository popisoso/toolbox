import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ParamStore, hexToRgb, type ParamSpec } from '../../src/engine/params';

const specs: ParamSpec[] = [
  { kind: 'range', key: 'grid', label: 'Grid', min: 0, max: 1, default: 0.2 },
  { kind: 'toggle', key: 'mirror', label: 'Mirror', default: true },
  { kind: 'action', key: 'go', label: 'Go' },
];

test('defaults, clamping and change notification', () => {
  const p = new ParamStore(specs);
  assert.equal(p.number('grid'), 0.2);
  const seen: [string, unknown][] = [];
  p.subscribe((k, v) => seen.push([k, v]));
  p.set('grid', 5);
  assert.equal(p.number('grid'), 1);
  p.set('grid', 1); // no-op: no second event
  p.set('go', 1);   // actions hold no value
  assert.deepEqual(seen, [['grid', 1]]);
  assert.throws(() => p.get('go'));
});

test('initial values override defaults; reset restores them', () => {
  const p = new ParamStore(specs, { grid: 0.9, unknown: 1 });
  assert.equal(p.number('grid'), 0.9);
  p.reset();
  assert.equal(p.number('grid'), 0.2);
  assert.equal(p.bool('mirror'), true);
});

test('hexToRgb', () => {
  assert.deepEqual(hexToRgb('#ffffff'), [1, 1, 1]);
  assert.deepEqual(hexToRgb('#000'), [0, 0, 0]);
});
