import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMiniGolfShot, createMiniGolfState, getMiniGolfMap } from './miniGolf.js';

const softPutt = { angle: 0, power: 0.08 };

test('Mini Golf provides three distinct selectable three-hole maps', () => {
  for (const id of ['garden-circuit', 'neon-workshop', 'alpine-table']) assert.equal(getMiniGolfMap(id).holes.length, 3);
  assert.equal(createMiniGolfState('neon-workshop').mapId, 'neon-workshop');
  assert.equal(createMiniGolfState('unknown-map'), null);
});

test('Mini Golf validates a drag shot and advances turn after server physics', () => {
  assert.equal(applyMiniGolfShot(createMiniGolfState(), 1, { angle: 0, power: 2 }).error, 'INVALID_ACTION');
  const result = applyMiniGolfShot(createMiniGolfState(), 1, { angle: 0, power: 0.5 });
  assert.equal(result.state.strokes[0], 1);
  assert.equal(result.nextPlayerMark, 2);
  assert.ok(result.state.balls[0].x > 145);
});

test('Mini Golf returns a water shot to the tee', () => {
  const state = createMiniGolfState('garden-circuit');
  state.holeIndex = 1;
  const hole = getMiniGolfMap('garden-circuit').holes[1];
  state.balls = [{ x: 500, y: 300 }, { ...hole.start }];
  const result = applyMiniGolfShot(state, 1, softPutt);
  assert.equal(result.state.lastShot.water, true);
  assert.deepEqual(result.state.balls[0], hole.start);
});

test('Mini Golf scores both players and advances to the next hole', () => {
  let state = createMiniGolfState('garden-circuit');
  const hole = getMiniGolfMap('garden-circuit').holes[0];
  state.balls[0] = { ...hole.cup };
  state = applyMiniGolfShot(state, 1, softPutt).state;
  state.balls[1] = { ...hole.cup };
  const result = applyMiniGolfShot(state, 2, softPutt);
  assert.deepEqual(result.state.scores[0], [1, 1]);
  assert.equal(result.state.holeIndex, 1);
  assert.equal(result.nextPlayerMark, 1);
});
