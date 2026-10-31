export const TIC_TAC_TOE_RULESET_VERSION = 1;

const winningLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function createTicTacToeState() {
  return { board: Array(9).fill(0), turnCount: 0, winner: null };
}

export function getWinner(board) {
  for (const [first, second, third] of winningLines) {
    if (board[first] && board[first] === board[second] && board[first] === board[third]) {
      return board[first];
    }
  }
  return null;
}

export function applyTicTacToeMove(state, mark, cell) {
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
    return { error: 'INVALID_ACTION', message: 'Choose a square on the board.' };
  }
  if (mark !== 1 && mark !== 2) {
    return { error: 'INVALID_ACTION', message: 'Invalid player mark.' };
  }
  if (!Array.isArray(state?.board) || state.board.length !== 9 || state.board.some((item) => ![0, 1, 2].includes(item))) {
    return { error: 'INVALID_ACTION', message: 'The match state is invalid.' };
  }
  if (state.board[cell] !== 0) {
    return { error: 'INVALID_ACTION', message: 'That square is already taken.' };
  }

  const board = [...state.board];
  board[cell] = mark;
  const winner = getWinner(board);
  const turnCount = state.turnCount + 1;
  return {
    state: { board, turnCount, winner },
    completed: Boolean(winner),
    draw: !winner && turnCount === 9,
  };
}
