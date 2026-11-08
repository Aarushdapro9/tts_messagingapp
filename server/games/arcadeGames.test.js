import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEightBallShot, applyFillerMove, applyKnockoutPlan, applyWordHuntWord, createEightBallState, createFillerState, createKnockoutState, createWordHuntState } from './arcadeGames.js';

test('Filler claims adjacent matching cells and alternates players', () => {
  const result = applyFillerMove(createFillerState(), 1, 'gold');
  assert.equal(result.nextPlayerMark, 2);
  assert.equal(result.state.playerColors[0], 'gold');
});

test('Word Hunt accepts a connected word only once', () => {
  const path = [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }, { row: 0, column: 3 }];
  const result = applyWordHuntWord(createWordHuntState(), 1, path);
  assert.equal(result.state.found[0][0], 'STAR');
  assert.equal(result.nextPlayerMark, 1);
  assert.equal(applyWordHuntWord(result.state, 2, path).error, 'INVALID_ACTION');
});

test('Knockout resolves both three-seal plans on one icy shrinking island', () => {
  const firstPlans = ['1-0', '1-1', '1-2'].map((pieceId) => ({ pieceId, angle: 0, power: .6 }));
  const secondPlans = ['2-0', '2-1', '2-2'].map((pieceId) => ({ pieceId, angle: Math.PI, power: .6 }));
  const waiting = applyKnockoutPlan(createKnockoutState(), 1, firstPlans);
  assert.equal(waiting.nextPlayerMark, 2);
  const resolved = applyKnockoutPlan(waiting.state, 2, secondPlans);
  assert.equal(resolved.state.round, 1);
  assert.ok(resolved.state.islandRadius < 270);
});

test('8 Ball accepts bounded server-side shots', () => {
  assert.ok(applyEightBallShot(createEightBallState(), 1, { angle: 0, power: .6 }).state.balls.length >= 2);
});
