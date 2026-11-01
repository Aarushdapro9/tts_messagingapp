/*
 * Shot controls and incremental collision ideas adapted from xFrednet's
 * 2D-mini-golf (MIT License, Copyright (c) 2020 xFrednet).
 * The complete attribution and license text is in docs/third-party-notices.md.
 * This implementation is an original JavaScript, server-authoritative version
 * for this app's multiplayer rules and original course layouts.
 */
export const MINI_GOLF_RULESET_VERSION = 3;

const COURSE_SIZE = { width: 1000, height: 600 };
const MAX_STROKES = 8;
const BALL_RADIUS = 12;
const CUP_RADIUS = 20;
const SHOT_STEP_DISTANCE = 7.5;
const MAX_SHOT_DISTANCE = 420;
const WALL_RESTITUTION = 0.72;

// Original course layouts and physics. This data deliberately does not copy
// layouts, art, or implementation from any third-party game.
export const MINI_GOLF_MAPS = [
  {
    id: 'garden-circuit', name: 'Garden Circuit', theme: 'garden',
    holes: [
      { name: 'Hedge Turn', par: 3, start: { x: 145, y: 455 }, cup: { x: 835, y: 145 }, walls: [{ x: 410, y: 70, width: 44, height: 350 }, { x: 610, y: 250, width: 44, height: 280 }], sand: [{ x: 690, y: 105, rx: 95, ry: 55 }], water: [] },
      { name: 'Lily Split', par: 3, start: { x: 150, y: 290 }, cup: { x: 850, y: 290 }, walls: [{ x: 350, y: 100, width: 36, height: 140 }, { x: 350, y: 360, width: 36, height: 140 }, { x: 650, y: 100, width: 36, height: 140 }, { x: 650, y: 360, width: 36, height: 140 }], sand: [], water: [{ x: 500, y: 300, rx: 102, ry: 140 }] },
      { name: 'Breeze Lane', par: 4, start: { x: 130, y: 470 }, cup: { x: 870, y: 135 }, walls: [{ x: 250, y: 70, width: 36, height: 330 }, { x: 500, y: 200, width: 36, height: 330 }, { x: 750, y: 70, width: 36, height: 330 }], sand: [{ x: 390, y: 435, rx: 105, ry: 60 }], water: [], slopes: [{ x: 600, y: 70, width: 115, height: 150, ax: 0, ay: 0.16 }] },
    ],
  },
  {
    id: 'neon-workshop', name: 'Neon Workshop', theme: 'neon',
    holes: [
      { name: 'Circuit Breaker', par: 3, start: { x: 125, y: 300 }, cup: { x: 875, y: 300 }, walls: [{ x: 300, y: 95, width: 42, height: 275 }, { x: 480, y: 230, width: 42, height: 275 }, { x: 660, y: 95, width: 42, height: 275 }], sand: [], water: [], slopes: [{ x: 540, y: 80, width: 90, height: 145, ax: 0, ay: 0.14 }] },
      { name: 'Magnet Bay', par: 4, start: { x: 135, y: 465 }, cup: { x: 845, y: 145 }, walls: [{ x: 240, y: 85, width: 42, height: 250 }, { x: 455, y: 265, width: 42, height: 250 }, { x: 675, y: 85, width: 42, height: 250 }], sand: [{ x: 560, y: 140, rx: 90, ry: 60 }], water: [{ x: 500, y: 400, rx: 115, ry: 72 }] },
      { name: 'Pulse Run', par: 3, start: { x: 140, y: 160 }, cup: { x: 850, y: 440 }, walls: [{ x: 285, y: 185, width: 390, height: 36 }, { x: 285, y: 385, width: 390, height: 36 }, { x: 675, y: 185, width: 36, height: 235 }], sand: [], water: [{ x: 485, y: 300, rx: 70, ry: 58 }], slopes: [{ x: 760, y: 110, width: 130, height: 120, ax: -0.12, ay: 0 }] },
    ],
  },
  {
    id: 'alpine-table', name: 'Alpine Table', theme: 'alpine',
    holes: [
      { name: 'Snowbank Bend', par: 3, start: { x: 150, y: 440 }, cup: { x: 845, y: 160 }, walls: [{ x: 345, y: 75, width: 38, height: 300 }, { x: 590, y: 225, width: 38, height: 300 }], sand: [], water: [], ice: [{ x: 650, y: 80, width: 220, height: 150 }] },
      { name: 'Pine Bridge', par: 4, start: { x: 140, y: 300 }, cup: { x: 865, y: 300 }, walls: [{ x: 325, y: 85, width: 40, height: 190 }, { x: 325, y: 325, width: 40, height: 190 }, { x: 635, y: 85, width: 40, height: 190 }, { x: 635, y: 325, width: 40, height: 190 }], sand: [{ x: 485, y: 300, rx: 90, ry: 80 }], water: [] },
      { name: 'Summit Switchback', par: 4, start: { x: 135, y: 475 }, cup: { x: 865, y: 125 }, walls: [{ x: 220, y: 90, width: 38, height: 280 }, { x: 465, y: 230, width: 38, height: 280 }, { x: 710, y: 90, width: 38, height: 280 }], sand: [{ x: 340, y: 445, rx: 70, ry: 48 }], water: [], ice: [{ x: 765, y: 90, width: 125, height: 170 }], slopes: [{ x: 535, y: 85, width: 110, height: 130, ax: 0, ay: 0.14 }] },
    ],
  },
];

export function getMiniGolfMap(mapId = 'garden-circuit') {
  return MINI_GOLF_MAPS.find((map) => map.id === mapId) || null;
}

function copyPoint(point) {
  return { x: point.x, y: point.y };
}

function createHolePositions(hole) {
  return { balls: [copyPoint(hole.start), copyPoint(hole.start)], strokes: [0, 0] };
}

export function createMiniGolfState(mapId = 'garden-circuit') {
  const map = getMiniGolfMap(mapId);
  if (!map) return null;
  return { mapId: map.id, holeIndex: 0, ...createHolePositions(map.holes[0]), scores: [], lastShot: null };
}

function inEllipse(zone, point) {
  const dx = (point.x - zone.x) / zone.rx;
  const dy = (point.y - zone.y) / zone.ry;
  return dx * dx + dy * dy <= 1;
}

function inRect(zone, point) {
  return point.x >= zone.x && point.x <= zone.x + zone.width && point.y >= zone.y && point.y <= zone.y + zone.height;
}

function pushOutOfRect(ball, wall, velocity) {
  const nearestX = Math.max(wall.x, Math.min(ball.x, wall.x + wall.width));
  const nearestY = Math.max(wall.y, Math.min(ball.y, wall.y + wall.height));
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  if (dx * dx + dy * dy > BALL_RADIUS * BALL_RADIUS) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    ball.x = nearestX + (dx >= 0 ? BALL_RADIUS : -BALL_RADIUS);
    velocity.x *= -WALL_RESTITUTION;
  } else {
    ball.y = nearestY + (dy >= 0 ? BALL_RADIUS : -BALL_RADIUS);
    velocity.y *= -WALL_RESTITUTION;
  }
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y);
  return length > 0 ? { x: vector.x / length, y: vector.y / length } : { x: 1, y: 0 };
}

function resolveCourseBounds(ball, velocity) {
  if (ball.x < BALL_RADIUS || ball.x > COURSE_SIZE.width - BALL_RADIUS) {
    ball.x = Math.max(BALL_RADIUS, Math.min(COURSE_SIZE.width - BALL_RADIUS, ball.x));
    velocity.x *= -WALL_RESTITUTION;
  }
  if (ball.y < BALL_RADIUS || ball.y > COURSE_SIZE.height - BALL_RADIUS) {
    ball.y = Math.max(BALL_RADIUS, Math.min(COURSE_SIZE.height - BALL_RADIUS, ball.y));
    velocity.y *= -WALL_RESTITUTION;
  }
}

function simulateShot(hole, initialBall, angle, power) {
  const ball = copyPoint(initialBall);
  // Like the reference project's GolfBall, release velocity is determined by
  // pull direction and the remaining travel distance is determined by strength.
  const velocity = normalize({ x: Math.cos(angle), y: Math.sin(angle) });
  let remainingDistance = Math.max(SHOT_STEP_DISTANCE, power * MAX_SHOT_DISTANCE);
  const start = hole.start;
  let water = false;

  if (Math.hypot(ball.x - hole.cup.x, ball.y - hole.cup.y) <= CUP_RADIUS) return { ball: copyPoint(hole.cup), water, sunk: true };

  while (remainingDistance > 0.001) {
    const travel = Math.min(SHOT_STEP_DISTANCE, remainingDistance);
    ball.x += velocity.x * travel;
    ball.y += velocity.y * travel;
    resolveCourseBounds(ball, velocity);
    (hole.walls || []).forEach((wall) => pushOutOfRect(ball, wall, velocity));
    if ((hole.water || []).some((zone) => inEllipse(zone, ball))) {
      water = true;
      return { ball: copyPoint(start), water, sunk: false };
    }
    const slope = (hole.slopes || []).find((zone) => inRect(zone, ball));
    if (slope) Object.assign(velocity, normalize({ x: velocity.x + (slope.ax || 0) * 0.45, y: velocity.y + (slope.ay || 0) * 0.45 }));
    if (Math.hypot(ball.x - hole.cup.x, ball.y - hole.cup.y) <= CUP_RADIUS) {
      return { ball: copyPoint(hole.cup), water, sunk: true };
    }
    remainingDistance -= travel;
  }
  return { ball, water, sunk: false };
}

function validShot(payload) {
  return Number.isFinite(payload?.angle) && Math.abs(payload.angle) <= Math.PI && Number.isFinite(payload?.power) && payload.power >= 0.08 && payload.power <= 1;
}

export function applyMiniGolfShot(state, player, payload) {
  if (player !== 1 && player !== 2) return { error: 'INVALID_ACTION', message: 'Invalid player.' };
  if (!validShot(payload)) return { error: 'INVALID_ACTION', message: 'Drag back from your ball to take a valid putt.' };
  if (!state || !Number.isInteger(state.holeIndex) || !Array.isArray(state.balls) || !Array.isArray(state.strokes) || !Array.isArray(state.scores)) {
    return { error: 'INVALID_ACTION', message: 'The Mini Golf match state is invalid.' };
  }
  const map = getMiniGolfMap(state.mapId || 'garden-circuit');
  const hole = map?.holes[state.holeIndex];
  if (!hole || state.balls.length !== 2 || state.strokes.length !== 2) return { error: 'INVALID_ACTION', message: 'The current hole is invalid.' };

  const playerIndex = player - 1;
  const holeScore = state.scores[state.holeIndex] || [null, null];
  if (holeScore[playerIndex] !== null) return { error: 'INVALID_ACTION', message: 'You have already finished this hole.' };
  const strokes = [...state.strokes];
  strokes[playerIndex] += 1;
  const result = simulateShot(hole, state.balls[playerIndex], payload.angle, payload.power);
  const balls = state.balls.map(copyPoint);
  balls[playerIndex] = result.ball;
  const scores = state.scores.map((score) => [...score]);
  const pickedUp = strokes[playerIndex] >= MAX_STROKES;
  if (result.sunk || pickedUp) scores[state.holeIndex] = playerIndex === 0 ? [result.sunk ? strokes[0] : MAX_STROKES, holeScore[1]] : [holeScore[0], result.sunk ? strokes[1] : MAX_STROKES];
  const updatedState = { ...state, mapId: map.id, balls, strokes, scores, lastShot: { player, power: payload.power, water: result.water, sunk: result.sunk, pickedUp } };
  const completeHole = updatedState.scores[state.holeIndex]?.every(Number.isInteger);
  if (!completeHole) return { state: updatedState, completed: false, nextPlayerMark: player === 1 ? 2 : 1 };

  if (state.holeIndex === map.holes.length - 1) {
    const totals = [0, 1].map((index) => updatedState.scores.reduce((total, score) => total + score[index], 0));
    return { state: { ...updatedState, totals }, completed: true, draw: totals[0] === totals[1], winnerMark: totals[0] === totals[1] ? null : totals[0] < totals[1] ? 1 : 2, nextPlayerMark: null };
  }

  const nextHoleIndex = state.holeIndex + 1;
  return { state: { ...updatedState, holeIndex: nextHoleIndex, ...createHolePositions(map.holes[nextHoleIndex]), lastShot: updatedState.lastShot }, completed: false, nextPlayerMark: 1 };
}
