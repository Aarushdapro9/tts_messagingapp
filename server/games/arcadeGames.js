// Native, server-authoritative implementations of the core rules used by the
// chat arcade.  They intentionally share no source/assets with third-party
// reference projects whose licences do not permit embedding.
export const ARCADE_RULESET_VERSION = 1;

const COLORS = ['coral', 'gold', 'mint', 'sky', 'violet', 'rose'];
const clone = (value) => structuredClone(value);
const other = (mark) => (mark === 1 ? 2 : 1);
const validMark = (mark) => mark === 1 || mark === 2;

function seededBoard(rows = 7, columns = 8) {
  let seed = 1640531527;
  const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed; };
  const board = Array.from({ length: rows }, () => Array(columns).fill('coral'));
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const excluded = new Set([board[row - 1]?.[column], board[row]?.[column - 1]]);
    board[row][column] = COLORS.filter((color) => !excluded.has(color))[next() % (COLORS.length - excluded.size)];
  }
  return board;
}

function countOwned(owners, mark) { return owners.flat().filter((owner) => owner === mark).length; }

export function createFillerState() {
  const board = seededBoard();
  const owners = Array.from({ length: 7 }, () => Array(8).fill(0));
  owners[6][0] = 1; owners[0][7] = 2;
  return { board, owners, playerColors: [board[6][0], board[0][7]], turnCount: 0 };
}

export function applyFillerMove(state, mark, color) {
  if (!validMark(mark) || !COLORS.includes(color)) return { error: 'INVALID_ACTION', message: 'Choose one of the six colours.' };
  if (!Array.isArray(state?.board) || !Array.isArray(state?.owners) || state.board.length !== 7 || state.owners.length !== 7) return { error: 'INVALID_ACTION', message: 'The Filler board is invalid.' };
  const index = mark - 1;
  if (state.playerColors.includes(color)) return { error: 'INVALID_ACTION', message: 'Choose a colour neither player currently owns.' };
  const next = clone(state); next.playerColors[index] = color; next.turnCount += 1;
  const queue = [];
  for (let row = 0; row < 7; row += 1) for (let column = 0; column < 8; column += 1) if (next.owners[row][column] === mark) { next.board[row][column] = color; queue.push([row, column]); }
  const visited = new Set(queue.map(([row, column]) => `${row}:${column}`));
  while (queue.length) {
    const [row, column] = queue.shift();
    [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]].forEach(([y, x]) => {
      const key = `${y}:${x}`;
      if (y < 0 || y >= 7 || x < 0 || x >= 8 || visited.has(key) || next.owners[y][x] || next.board[y][x] !== color) return;
      visited.add(key); next.owners[y][x] = mark; queue.push([y, x]);
    });
  }
  const unclaimed = next.owners.flat().includes(0);
  if (!unclaimed || next.turnCount >= 48) {
    const scores = [countOwned(next.owners, 1), countOwned(next.owners, 2)];
    return { state: { ...next, scores }, completed: scores[0] !== scores[1], draw: scores[0] === scores[1], winnerMark: scores[0] === scores[1] ? null : scores[0] > scores[1] ? 1 : 2 };
  }
  return { state: next, nextPlayerMark: other(mark) };
}

const WORD_BOARD = ['STAR', 'LION', 'MINT', 'CODE'];
const DICTIONARY = new Set(['STAR', 'LION', 'MINT', 'CODE', 'LINE', 'MINE', 'TONE', 'NOTE', 'STONE', 'COIN', 'COAT', 'COLD', 'MIND', 'MINE', 'TAR', 'ART', 'TIN', 'TON', 'ONE', 'LIE', 'LION']);
export function createWordHuntState() { return { board: WORD_BOARD.map((row) => row.split('')), found: [[], []], scores: [0, 0], turnCount: 0 }; }
function pathWord(board, path) { return path.map(({ row, column }) => board[row]?.[column] || '').join(''); }
export function applyWordHuntWord(state, mark, path) {
  if (!validMark(mark) || !Array.isArray(path) || path.length < 3 || path.length > 16) return { error: 'INVALID_ACTION', message: 'Select a connected word of at least three letters.' };
  if (!Array.isArray(state?.board) || !Array.isArray(state?.found)) return { error: 'INVALID_ACTION', message: 'The Word Hunt board is invalid.' };
  const seen = new Set();
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index]; const key = `${point?.row}:${point?.column}`; const previous = path[index - 1];
    if (!Number.isInteger(point?.row) || !Number.isInteger(point?.column) || point.row < 0 || point.row > 3 || point.column < 0 || point.column > 3 || seen.has(key) || (previous && Math.max(Math.abs(point.row - previous.row), Math.abs(point.column - previous.column)) !== 1)) return { error: 'INVALID_ACTION', message: 'Trace neighbouring tiles without reusing one.' };
    seen.add(key);
  }
  const word = pathWord(state.board, path).toUpperCase();
  if (!DICTIONARY.has(word) || state.found.flat().includes(word)) return { error: 'INVALID_ACTION', message: 'That word is not available on this board.' };
  const next = clone(state); next.found[mark - 1].push(word); next.scores[mark - 1] += word.length; next.turnCount += 1;
  // A compact four-word round keeps the game practical in an asynchronous DM
  // while the board and score remain identical for both players.
  const complete = next.found.flat().length >= 4;
  return complete ? { state: next, completed: next.scores[0] !== next.scores[1], draw: next.scores[0] === next.scores[1], winnerMark: next.scores[0] === next.scores[1] ? null : next.scores[0] > next.scores[1] ? 1 : 2 } : { state: next, nextPlayerMark: other(mark) };
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function simulatePuck(state, pieceId, angle, power) {
  const next = clone(state); const piece = next.pieces.find((item) => item.id === pieceId);
  if (!piece) return null;
  let vx = Math.cos(angle) * power * 31; let vy = Math.sin(angle) * power * 31;
  for (let step = 0; step < 180; step += 1) {
    piece.x += vx; piece.y += vy;
    for (const target of next.pieces) if (target !== piece && distance(piece, target) < 36) { const dx = target.x - piece.x || 1; const dy = target.y - piece.y || 1; const length = Math.hypot(dx, dy); target.x += (dx / length) * 22; target.y += (dy / length) * 22; vx *= 0.62; vy *= 0.62; }
    if (piece.x < -35 || piece.x > 1035 || piece.y < -35 || piece.y > 635) break;
    vx *= 0.976; vy *= 0.976; if (Math.hypot(vx, vy) < 0.25) break;
  }
  next.pieces = next.pieces.filter((item) => item.x >= 18 && item.x <= 982 && item.y >= 18 && item.y <= 582);
  return next;
}
export function createKnockoutState() { return { pieces: [1, 2].flatMap((owner) => [0, 1, 2].map((index) => ({ id: `${owner}-${index}`, owner, x: owner === 1 ? 150 : 850, y: 170 + index * 120 }))), turnCount: 0 }; }
export function applyKnockoutPush(state, mark, payload) {
  if (!validMark(mark) || !Number.isFinite(payload?.angle) || !Number.isFinite(payload?.power) || payload.power < .1 || payload.power > 1) return { error: 'INVALID_ACTION', message: 'Pull back a seal and release to launch it.' };
  if (!state?.pieces?.some((piece) => piece.id === payload.pieceId && piece.owner === mark)) return { error: 'INVALID_ACTION', message: 'Choose one of your seals.' };
  const next = simulatePuck(state, payload.pieceId, payload.angle, payload.power); next.turnCount += 1;
  const remaining = [1, 2].map((owner) => next.pieces.filter((piece) => piece.owner === owner).length);
  return remaining.includes(0) ? { state: next, completed: true, winnerMark: remaining[0] ? 1 : 2 } : { state: next, nextPlayerMark: other(mark) };
}

export function createEightBallState() {
  const balls = [{ id: 'cue', x: 180, y: 260, kind: 'cue' }, ...Array.from({ length: 7 }, (_, index) => ({ id: `ball-${index + 1}`, x: 690 + (index % 3) * 27, y: 230 + Math.floor(index / 3) * 29 + (index % 2) * 14, kind: index === 6 ? 'eight' : index % 2 ? 'stripe' : 'solid' }))];
  return { balls, pocketed: [[], []], assignments: [null, null], turnCount: 0 };
}
export function applyEightBallShot(state, mark, payload) {
  if (!validMark(mark) || !Number.isFinite(payload?.angle) || !Number.isFinite(payload?.power) || payload.power < .1 || payload.power > 1 || !Array.isArray(state?.balls)) return { error: 'INVALID_ACTION', message: 'Pull back from the cue ball and release.' };
  const next = clone(state); const cue = next.balls.find((ball) => ball.id === 'cue'); let vx = Math.cos(payload.angle) * payload.power * 28; let vy = Math.sin(payload.angle) * payload.power * 28; const before = next.balls.length;
  for (let step = 0; step < 240; step += 1) {
    cue.x += vx; cue.y += vy;
    if (cue.x < 20 || cue.x > 980) { cue.x = Math.max(20, Math.min(980, cue.x)); vx *= -.82; }
    if (cue.y < 20 || cue.y > 560) { cue.y = Math.max(20, Math.min(560, cue.y)); vy *= -.82; }
    for (const ball of next.balls) if (ball !== cue && distance(cue, ball) < 34) { ball.x += Math.cos(payload.angle) * 18; ball.y += Math.sin(payload.angle) * 18; vx *= .68; vy *= .68; }
    vx *= .982; vy *= .982; if (Math.hypot(vx, vy) < .2) break;
  }
  const pockets = [{ x: 20, y: 20 }, { x: 500, y: 20 }, { x: 980, y: 20 }, { x: 20, y: 560 }, { x: 500, y: 560 }, { x: 980, y: 560 }];
  const pocketed = next.balls.filter((ball) => ball.kind !== 'cue' && pockets.some((pocket) => distance(ball, pocket) < 42));
  next.balls = next.balls.filter((ball) => !pocketed.includes(ball)); next.pocketed[mark - 1].push(...pocketed.map((ball) => ball.id)); next.turnCount += 1;
  if (!next.assignments[mark - 1]) { const first = pocketed.find((ball) => ball.kind !== 'eight'); if (first) { next.assignments[mark - 1] = first.kind; next.assignments[other(mark) - 1] = first.kind === 'solid' ? 'stripe' : 'solid'; } }
  const eight = pocketed.find((ball) => ball.kind === 'eight');
  if (eight) { const cleared = next.assignments[mark - 1] && !next.balls.some((ball) => ball.kind === next.assignments[mark - 1]); return { state: next, completed: true, winnerMark: cleared ? mark : other(mark) }; }
  return { state: next, nextPlayerMark: pocketed.length ? mark : other(mark) };
}
