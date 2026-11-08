import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMiniGolfShot, createMiniGolfState, getMiniGolfMap, movingObstacleRects } from './miniGolf.js';

const softPutt = { angle: 0, power: 0.08 };

test('Mini Golf ports the reference project as one five-level course', () => {
  const map = getMiniGolfMap('classic-2d-mini-golf');
  assert.equal(map.holes.length, 5);
  assert.deepEqual(map.holes[0].cup, { x: 100, y: 100 });
  assert.deepEqual(map.holes[4].cup, { x: 550, y: 600 });
  assert.equal(createMiniGolfState().mapId, 'classic-2d-mini-golf');
  assert.equal(createMiniGolfState('unknown-map'), null);
});

test('Mini Golf validates a drag shot and keeps the player on the hole', () => {
  assert.equal(applyMiniGolfShot(createMiniGolfState(), 1, { angle: 0, power: 2 }).error, 'INVALID_ACTION');
  const result = applyMiniGolfShot(createMiniGolfState(), 1, { angle: 0, power: 0.5 });
  assert.equal(result.state.strokes[0], 1);
  assert.equal(result.nextPlayerMark, 1);
  assert.equal(applyMiniGolfShot(result.state, 2, softPutt).error, 'NOT_YOUR_TURN');
  assert.ok(result.state.balls[0].x > 100);
});

test('Mini Golf includes the reference sine and circular moving obstacles', () => {
  const map = getMiniGolfMap();
  assert.equal(map.holes[1].movingObstacles.length, 14);
  assert.equal(map.holes[3].movingObstacles.length, 11);
  const first = movingObstacleRects(map.holes[1], 0)[0];
  const later = movingObstacleRects(map.holes[1], 1)[0];
  assert.notEqual(first.x, later.x);
});

test('Mini Golf resolves a stepped wall collision before finishing a shot', () => {
  const state = createMiniGolfState();
  state.balls[0] = { x: 100, y: 330 };
  const result = applyMiniGolfShot(state, 1, { angle: Math.PI / 2, power: 0.2 });
  assert.equal(result.nextPlayerMark, 1);
  assert.ok(result.state.balls[0].y < 345, 'the ball should reflect from the first level wall');
});

test('Mini Golf scores both players and advances to the next level', () => {
  let state = createMiniGolfState();
  const hole = getMiniGolfMap().holes[0];
  state.balls[0] = { ...hole.cup };
  state = applyMiniGolfShot(state, 1, softPutt).state;
  state.balls[1] = { ...hole.cup };
  const result = applyMiniGolfShot(state, 2, softPutt);
  assert.deepEqual(result.state.scores[0], [1, 1]);
  assert.equal(result.state.holeIndex, 1);
  assert.equal(result.nextPlayerMark, 1);
});
