import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipsAt, timelineDuration, type Timeline } from '../../src/engine/compose/timeline';

const tl: Timeline = {
  duration: 10,
  clips: [
    { id: 'a', moduleId: 'noise-grid', start: 0, end: 6, track: 0, fadeOut: 2 },
    { id: 'b', moduleId: 'video-input', start: 4, end: 12, track: 1, fadeIn: 2 },
  ],
};

test('active clips ordered by track with fades', () => {
  const at5 = clipsAt(tl, 5);
  assert.equal(at5.length, 2);
  assert.equal(at5[0]!.clip.id, 'a');
  assert.ok(Math.abs(at5[0]!.opacity - 0.5) < 1e-9); // 1s left of 2s fade-out
  assert.ok(Math.abs(at5[1]!.opacity - 0.5) < 1e-9); // 1s into 2s fade-in
});

test('boundaries are half-open', () => {
  assert.equal(clipsAt(tl, 6).length, 1);
  assert.equal(clipsAt(tl, 6)[0]!.clip.id, 'b');
  assert.equal(clipsAt(tl, 12).length, 0);
});

test('duration extends to the last clip', () => {
  assert.equal(timelineDuration(tl), 12);
});
