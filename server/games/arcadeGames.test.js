import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEightBallShot, applyFillerMove, applyKnockoutPush, applyWordHuntWord, createEightBallState, createFillerState, createKnockoutState, createWordHuntState } from './arcadeGames.js';

test('Filler claims adjacent matching cells and alternates players', () => {
  const result = applyFillerMove(createFillerState(), 1, 'gold');
  assert.equal(result.nextPlayerMark, 2);
  assert.equal(result.state.playerColors[0], 'gold');
});

test('Word Hunt accepts a connected word only once', () => {
  const path = [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }, { row: 0, column: 3 }];
  const result = applyWordHuntWord(createWordHuntState(), 1, path);
  assert.equal(result.state.found[0][0], 'STAR');
  assert.equal(applyWordHuntWord(result.state, 2, path).error, 'INVALID_ACTION');
});

test('Knockout and 8 Ball accept bounded server-side shots', () => {
  assert.equal(applyKnockoutPush(createKnockoutState(), 1, { pieceId: '1-0', angle: 0, power: .6 }).nextPlayerMark, 2);
  assert.ok(applyEightBallShot(createEightBallState(), 1, { angle: 0, power: .6 }).state.balls.length >= 2);
});
