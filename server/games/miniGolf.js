/*
 * Multiplayer browser port of xFrednet/2D-mini-golf (MIT License,
 * Copyright (c) 2020 xFrednet). See docs/third-party-notices.md.
 *
 * The original is a single-player Python/Pygame/OpenGL game. This module
 * ports its five level layouts, drag-to-aim controls, stepped collisions and
 * moving obstacle patterns to the server-authoritative web match model.
 */
export const MINI_GOLF_RULESET_VERSION = 5;

const COURSE_SIZE = { width: 1200, height: 700 };
const MAX_STROKES = 8;
const BALL_RADIUS = 10;
const CUP_RADIUS = 25;
// Physics is intentionally fixed-step and server-side.  Keeping these values
// together makes course tuning safe without making a client frame rate part of
// an authoritative result.
export const MINI_GOLF_PHYSICS = Object.freeze({
  fixedStep: 1 / 60,
  launchSpeed: 1080,
  rollingDamping: 0.986,
  stopSpeed: 8,
  maxSimulationSteps: 420,
  wallRestitution: 0.86,
});

const rect = (cx, cy, width, height) => ({ x: cx - width / 2, y: cy - height / 2, width, height });
const cross = (size = 100, thickness = 10) => [rect(0, 0, size, thickness), rect(0, 0, thickness, size)];
const hShape = (size = 100, thickness = 10) => [
  rect(0, 0, size, thickness),
  rect(size / 2 - thickness / 2, 0, thickness, size),
  rect(-(size / 2 - thickness / 2), 0, thickness, size),
];

// These are the five level object layouts from the MIT reference project.
// A two-player match resets both balls at the same tee for each level so each
// player gets an equivalent turn sequence.
const tee = { x: 100, y: 600 };
const level = (name, cup, walls = [], movingObstacles = []) => ({ name, par: 3, start: tee, cup, bounds: COURSE_SIZE, walls, movingObstacles });

export const MINI_GOLF_MAPS = [{
  id: 'classic-2d-mini-golf',
  name: '2D Mini Golf',
  theme: 'classic',
  source: 'xFrednet/2D-mini-golf',
  holes: [
    level('Level 1', { x: 100, y: 100 }, [rect(550, 350, 1100, 10)]),
    level('Level 2', { x: 1100, y: 100 }, [], Array.from({ length: 14 }, (_, index) => ({
      id: `sine-gate-${index + 1}`,
      type: 'sine', origin: { x: 600, y: 25 + index * 50 }, size: { width: 10, height: 50 },
      amplitude: { x: 400, y: 0 }, speed: 1, phase: (Math.PI * 2 / 14) * (index + 1),
    }))),
    level('Level 3', { x: 100, y: 650 }, [
      rect(200, 595, 400, 10), rect(400, 300, 10, 600), rect(500, 400, 10, 600),
      rect(600, 300, 10, 600), rect(700, 400, 10, 600), rect(800, 300, 10, 600), rect(900, 400, 10, 600),
    ], [{
      id: 'sine-bridge', type: 'sine', origin: { x: 650, y: 350 }, size: { width: 88, height: 60 },
      pieces: [rect(0, 25, 88, 10), rect(0, -25, 88, 10)], amplitude: { x: 0, y: 300 }, speed: 0.5, phase: 0,
    }]),
    level('Level 4', { x: 100, y: 175 }, [rect(550, 350, 1100, 10)], [
      { id: 'sine-cross', type: 'sine', origin: { x: 1150, y: 350 }, pieces: cross(), amplitude: { x: 0, y: 100 }, speed: 1, phase: 0 },
      { id: 'orbit-top-large', type: 'circle', origin: { x: 550, y: 175 }, pieces: hShape(50), radius: 150, speed: 1, phase: 0 },
      { id: 'orbit-top-small', type: 'circle', origin: { x: 550, y: 175 }, pieces: hShape(50), radius: 62.5, speed: 1, phase: 0 },
      ...Array.from({ length: 8 }, (_, index) => ({ id: `orbit-bottom-${index + 1}`, type: 'circle', origin: { x: 550, y: 525 }, pieces: hShape(50), radius: 150, speed: 1, phase: (Math.PI * 2 / 8) * (index + 1) })),
    ]),
    level('Level 5', { x: 550, y: 600 }),
  ],
}];

export function getMiniGolfMap(mapId = 'classic-2d-mini-golf') {
  return MINI_GOLF_MAPS.find((map) => map.id === mapId) || null;
}

const copyPoint = (point) => ({ x: point.x, y: point.y });
const createHolePositions = (hole) => ({ balls: [copyPoint(hole.start), copyPoint(hole.start)], strokes: [0, 0] });

export function createMiniGolfState(mapId = 'classic-2d-mini-golf') {
  const map = getMiniGolfMap(mapId);
  if (!map) return null;
  return { mapId: map.id, holeIndex: 0, ...createHolePositions(map.holes[0]), scores: [], lastShot: null };
}

const normalize = (vector) => {
  const length = Math.hypot(vector.x, vector.y);
  return length > 0 ? { x: vector.x / length, y: vector.y / length } : { x: 1, y: 0 };
};

function obstacleOffset(obstacle, seconds) {
  const phase = seconds * (obstacle.speed || 1) + (obstacle.phase || 0);
  if (obstacle.type === 'circle') return { x: Math.sin(phase) * obstacle.radius, y: Math.cos(phase) * obstacle.radius };
  return { x: Math.sin(phase) * (obstacle.amplitude?.x || 0), y: Math.sin(phase) * (obstacle.amplitude?.y || 0) };
}

export function movingObstacleRects(hole, seconds) {
  return (hole.movingObstacles || []).flatMap((obstacle) => {
    const offset = obstacleOffset(obstacle, seconds);
    const pieces = obstacle.pieces || [rect(0, 0, obstacle.size.width, obstacle.size.height)];
    return pieces.map((piece) => ({
      x: obstacle.origin.x + offset.x + piece.x,
      y: obstacle.origin.y + offset.y + piece.y,
      width: piece.width,
      height: piece.height,
    }));
  });
}

function pushOutOfRect(ball, wall, velocity) {
  const nearestX = Math.max(wall.x, Math.min(ball.x, wall.x + wall.width));
  const nearestY = Math.max(wall.y, Math.min(ball.y, wall.y + wall.height));
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  if (dx * dx + dy * dy > BALL_RADIUS * BALL_RADIUS) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    ball.x = nearestX + (dx >= 0 ? BALL_RADIUS : -BALL_RADIUS);
    velocity.x *= -MINI_GOLF_PHYSICS.wallRestitution;
  } else {
    ball.y = nearestY + (dy >= 0 ? BALL_RADIUS : -BALL_RADIUS);
    velocity.y *= -MINI_GOLF_PHYSICS.wallRestitution;
  }
}

function resolveCourseBounds(ball, velocity) {
  if (ball.x < BALL_RADIUS || ball.x > COURSE_SIZE.width - BALL_RADIUS) {
    ball.x = Math.max(BALL_RADIUS, Math.min(COURSE_SIZE.width - BALL_RADIUS, ball.x));
    velocity.x *= -MINI_GOLF_PHYSICS.wallRestitution;
  }
  if (ball.y < BALL_RADIUS || ball.y > COURSE_SIZE.height - BALL_RADIUS) {
    ball.y = Math.max(BALL_RADIUS, Math.min(COURSE_SIZE.height - BALL_RADIUS, ball.y));
    velocity.y *= -MINI_GOLF_PHYSICS.wallRestitution;
  }
}

function simulateShot(hole, initialBall, angle, power, startSeconds) {
  const ball = copyPoint(initialBall);
  const direction = normalize({ x: Math.cos(angle), y: Math.sin(angle) });
  const velocity = {
    x: direction.x * power * MINI_GOLF_PHYSICS.launchSpeed,
    y: direction.y * power * MINI_GOLF_PHYSICS.launchSpeed,
  };

  if (Math.hypot(ball.x - hole.cup.x, ball.y - hole.cup.y) <= CUP_RADIUS) return { ball: copyPoint(hole.cup), sunk: true };
  for (let step = 0; step < MINI_GOLF_PHYSICS.maxSimulationSteps; step += 1) {
    ball.x += velocity.x * MINI_GOLF_PHYSICS.fixedStep;
    ball.y += velocity.y * MINI_GOLF_PHYSICS.fixedStep;
    resolveCourseBounds(ball, velocity);
    const motionSeconds = startSeconds + step * MINI_GOLF_PHYSICS.fixedStep;
    [...(hole.walls || []), ...movingObstacleRects(hole, motionSeconds)].forEach((wall) => pushOutOfRect(ball, wall, velocity));
    if (Math.hypot(ball.x - hole.cup.x, ball.y - hole.cup.y) <= CUP_RADIUS) return { ball: copyPoint(hole.cup), sunk: true };
    velocity.x *= MINI_GOLF_PHYSICS.rollingDamping;
    velocity.y *= MINI_GOLF_PHYSICS.rollingDamping;
    if (Math.hypot(velocity.x, velocity.y) < MINI_GOLF_PHYSICS.stopSpeed) break;
  }
  return { ball, sunk: false };
}

function validShot(payload) {
  return Number.isFinite(payload?.angle) && Math.abs(payload.angle) <= Math.PI && Number.isFinite(payload?.power) && payload.power >= 0.08 && payload.power <= 1;
}

export function applyMiniGolfShot(state, player, payload) {
  if (player !== 1 && player !== 2) return { error: 'INVALID_ACTION', message: 'Invalid player.' };
  if (!validShot(payload)) return { error: 'INVALID_ACTION', message: 'Drag back from your ball to take a valid putt.' };
  if (!state || !Number.isInteger(state.holeIndex) || !Array.isArray(state.balls) || !Array.isArray(state.strokes) || !Array.isArray(state.scores)) return { error: 'INVALID_ACTION', message: 'The Mini Golf match state is invalid.' };
  const map = getMiniGolfMap(state.mapId || 'classic-2d-mini-golf');
  const hole = map?.holes[state.holeIndex];
  if (!hole || state.balls.length !== 2 || state.strokes.length !== 2) return { error: 'INVALID_ACTION', message: 'The current hole is invalid.' };

  const playerIndex = player - 1;
  const holeScore = state.scores[state.holeIndex] || [null, null];
  if (holeScore[playerIndex] !== null) return { error: 'INVALID_ACTION', message: 'You have already finished this level.' };
  const strokes = [...state.strokes];
  strokes[playerIndex] += 1;
  const result = simulateShot(hole, state.balls[playerIndex], payload.angle, payload.power, Date.now() / 1000);
  const balls = state.balls.map(copyPoint);
  balls[playerIndex] = result.ball;
  const scores = state.scores.map((score) => [...score]);
  const pickedUp = strokes[playerIndex] >= MAX_STROKES;
  if (result.sunk || pickedUp) scores[state.holeIndex] = playerIndex === 0 ? [result.sunk ? strokes[0] : MAX_STROKES, holeScore[1]] : [holeScore[0], result.sunk ? strokes[1] : MAX_STROKES];
  const updatedState = { ...state, mapId: map.id, balls, strokes, scores, lastShot: { player, power: payload.power, sunk: result.sunk, pickedUp } };
  const completeHole = updatedState.scores[state.holeIndex]?.every(Number.isInteger);
  if (!completeHole) return { state: updatedState, completed: false, nextPlayerMark: player === 1 ? 2 : 1 };

  if (state.holeIndex === map.holes.length - 1) {
    const totals = [0, 1].map((index) => updatedState.scores.reduce((total, score) => total + score[index], 0));
    return { state: { ...updatedState, totals }, completed: true, draw: totals[0] === totals[1], winnerMark: totals[0] === totals[1] ? null : totals[0] < totals[1] ? 1 : 2, nextPlayerMark: null };
  }
  const nextHoleIndex = state.holeIndex + 1;
  return { state: { ...updatedState, holeIndex: nextHoleIndex, ...createHolePositions(map.holes[nextHoleIndex]), lastShot: updatedState.lastShot }, completed: false, nextPlayerMark: 1 };
}
