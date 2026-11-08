// Native, server-authoritative implementations of the core rules used by the
// chat arcade.  They intentionally share no source/assets with third-party
// reference projects whose licences do not permit embedding.
export const ARCADE_RULESET_VERSION = 2;

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
  // Word Hunt uses two timed turns. A valid word never hands the board to the
  // opponent; the controller advances the turn only when its server timer ends.
  return { state: next, nextPlayerMark: mark };
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
const KNOCKOUT_CENTER = { x: 500, y: 300 };
const KNOCKOUT_PIECE_RADIUS = 18;
const KNOCKOUT_ICE_DAMPING = 0.991;
const KNOCKOUT_MIN_ISLAND_RADIUS = 112;
const KNOCKOUT_SHRINK_PER_ROUND = 18;

function islandDistance(piece) { return Math.hypot(piece.x - KNOCKOUT_CENTER.x, piece.y - KNOCKOUT_CENTER.y); }

function validKnockoutPlans(pieces, mark, plans) {
  if (!Array.isArray(plans) || plans.length !== 3) return false;
  const ownIds = new Set(pieces.filter((piece) => piece.owner === mark).map((piece) => piece.id));
  const used = new Set();
  return plans.every((plan) => Number.isFinite(plan?.angle) && Number.isFinite(plan?.power) && plan.power >= .08 && plan.power <= 1 && ownIds.has(plan.pieceId) && !used.has(plan.pieceId) && (used.add(plan.pieceId) || true));
}

function simulateKnockoutRound(state) {
  const next = clone(state);
  const plans = [...(next.plans?.[1] || []), ...(next.plans?.[2] || [])];
  const velocity = new Map(plans.map((plan) => [plan.pieceId, { x: Math.cos(plan.angle) * plan.power * 30, y: Math.sin(plan.angle) * plan.power * 30 }]));
  next.pieces.forEach((piece) => { if (!velocity.has(piece.id)) velocity.set(piece.id, { x: 0, y: 0 }); });

  for (let step = 0; step < 300; step += 1) {
    next.pieces.forEach((piece) => {
      const speed = velocity.get(piece.id);
      piece.x += speed.x;
      piece.y += speed.y;
    });
    for (let first = 0; first < next.pieces.length; first += 1) for (let second = first + 1; second < next.pieces.length; second += 1) {
      const a = next.pieces[first]; const b = next.pieces[second];
      const dx = b.x - a.x; const dy = b.y - a.y; const gap = Math.hypot(dx, dy) || 0.001;
      if (gap >= KNOCKOUT_PIECE_RADIUS * 2) continue;
      const nx = dx / gap; const ny = dy / gap; const overlap = (KNOCKOUT_PIECE_RADIUS * 2 - gap) / 2;
      a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
      const av = velocity.get(a.id); const bv = velocity.get(b.id); const alongNormal = (av.x - bv.x) * nx + (av.y - bv.y) * ny;
      if (alongNormal <= 0) continue;
      const impulse = alongNormal * .88;
      av.x -= impulse * nx; av.y -= impulse * ny; bv.x += impulse * nx; bv.y += impulse * ny;
    }
    let moving = false;
    velocity.forEach((speed) => { speed.x *= KNOCKOUT_ICE_DAMPING; speed.y *= KNOCKOUT_ICE_DAMPING; moving ||= Math.hypot(speed.x, speed.y) > .12; });
    if (!moving) break;
  }

  const islandRadius = Math.max(KNOCKOUT_MIN_ISLAND_RADIUS, (next.islandRadius || 270) - KNOCKOUT_SHRINK_PER_ROUND);
  next.pieces = next.pieces.filter((piece) => islandDistance(piece) <= islandRadius - KNOCKOUT_PIECE_RADIUS);
  next.round = (next.round || 0) + 1;
  next.turnCount = (next.turnCount || 0) + 1;
  next.islandRadius = islandRadius;
  next.plans = { 1: null, 2: null };
  return next;
}

export function createKnockoutState() {
  return {
    pieces: [1, 2].flatMap((owner) => [0, 1, 2].map((index) => ({ id: `${owner}-${index}`, owner, x: owner === 1 ? 355 : 645, y: 210 + index * 90 }))),
    round: 0, turnCount: 0, islandRadius: 270, plans: { 1: null, 2: null },
  };
}

export function applyKnockoutPlan(state, mark, plans) {
  if (!validMark(mark) || !Array.isArray(state?.pieces) || !validKnockoutPlans(state.pieces, mark, plans)) return { error: 'INVALID_ACTION', message: 'Pull back each of your three seals before submitting the round.' };
  const next = clone(state);
  next.plans ||= { 1: null, 2: null };
  if (next.plans[mark]) return { error: 'INVALID_ACTION', message: 'Your three moves are already locked in.' };
  next.plans[mark] = plans.map(({ pieceId, angle, power }) => ({ pieceId, angle, power }));
  if (!next.plans[other(mark)]) return { state: next, nextPlayerMark: other(mark) };
  const resolved = simulateKnockoutRound(next);
  const remaining = [1, 2].map((owner) => resolved.pieces.filter((piece) => piece.owner === owner).length);
  return remaining.includes(0)
    ? { state: resolved, completed: remaining[0] !== remaining[1], draw: remaining[0] === remaining[1], winnerMark: remaining[0] === remaining[1] ? null : remaining[0] ? 1 : 2 }
    : { state: resolved, nextPlayerMark: 1 };
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
