import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTicTacToeMove, createTicTacToeState, getWinner } from './ticTacToe.js';

test('accepts a legal move without mutating the prior state', () => {
  const before = createTicTacToeState();
  const result = applyTicTacToeMove(before, 1, 4);
  assert.deepEqual(before.board, Array(9).fill(0));
  assert.deepEqual(result.state.board, [0, 0, 0, 0, 1, 0, 0, 0, 0]);
  assert.equal(result.state.turnCount, 1);
});

test('rejects invalid and already occupied squares', () => {
  const state = { board: [1, 0, 0, 0, 0, 0, 0, 0, 0], turnCount: 1, winner: null };
  assert.equal(applyTicTacToeMove(state, 2, 0).error, 'INVALID_ACTION');
  assert.equal(applyTicTacToeMove(state, 2, 9).error, 'INVALID_ACTION');
});

test('detects every winning line', () => {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  for (const line of lines) {
    const board = Array(9).fill(0);
    line.forEach((cell) => { board[cell] = 2; });
    assert.equal(getWinner(board), 2);
  }
});

test('returns a draw only for a full board with no winner', () => {
  const state = { board: [1, 2, 1, 1, 2, 2, 2, 1, 0], turnCount: 8, winner: null };
  const result = applyTicTacToeMove(state, 1, 8);
  assert.equal(result.draw, true);
  assert.equal(result.completed, false);
});
