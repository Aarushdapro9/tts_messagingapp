import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMiniGolfShot, createMiniGolfState, getMiniGolfMap } from './miniGolf.js';

test('Mini Golf provides three distinct selectable three-hole maps', () => {
  assert.equal(getMiniGolfMap('sunset-links').holes.length, 3);
  assert.equal(getMiniGolfMap('neon-night').holes.length, 3);
  assert.equal(getMiniGolfMap('forest-run').holes.length, 3);
  assert.equal(createMiniGolfState('neon-night').mapId, 'neon-night');
  assert.equal(createMiniGolfState('unknown-map'), null);
});

test('Mini Golf validates power and advances turn after a shot', () => {
  assert.equal(applyMiniGolfShot(createMiniGolfState(), 1, 6).error, 'INVALID_ACTION');
  const result = applyMiniGolfShot(createMiniGolfState(), 1, 3);
  assert.equal(result.state.strokes[0], 1);
  assert.equal(result.nextPlayerMark, 2);
});

test('Mini Golf records a hole and moves both players to the next course', () => {
  let state = createMiniGolfState();
  state = applyMiniGolfShot(state, 1, 5).state;
  const result = applyMiniGolfShot(state, 2, 5);
  assert.deepEqual(result.state.scores[0], [1, 1]);
  assert.equal(result.state.holeIndex, 1);
  assert.equal(result.nextPlayerMark, 1);
});
