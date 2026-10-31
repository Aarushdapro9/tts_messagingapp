export const MINI_GOLF_RULESET_VERSION = 1;

// Course data is server-owned. Every shot is calculated from this definition.
export const MINI_GOLF_MAPS = [
  { id: 'sunset-links', name: 'Sunset Links', holes: [{ distance: 48, par: 3, wind: 0 }, { distance: 62, par: 4, wind: -2 }, { distance: 55, par: 3, wind: 2 }] },
  { id: 'neon-night', name: 'Neon Night', holes: [{ distance: 42, par: 3, wind: 3 }, { distance: 66, par: 4, wind: 0 }, { distance: 51, par: 3, wind: -3 }] },
  { id: 'forest-run', name: 'Forest Run', holes: [{ distance: 53, par: 4, wind: -1 }, { distance: 47, par: 3, wind: 1 }, { distance: 70, par: 4, wind: -2 }] },
];

export function getMiniGolfMap(mapId = 'sunset-links') {
  return MINI_GOLF_MAPS.find((map) => map.id === mapId) || null;
}

export function createMiniGolfState(mapId = 'sunset-links') {
  const map = getMiniGolfMap(mapId);
  if (!map) return null;
  return { mapId: map.id, holeIndex: 0, distances: [map.holes[0].distance, map.holes[0].distance], strokes: [0, 0], scores: [] };
}

export function miniGolfHole(mapId, index) {
  return getMiniGolfMap(mapId)?.holes[index] || null;
}

export function applyMiniGolfShot(state, player, power) {
  if (player !== 1 && player !== 2) return { error: 'INVALID_ACTION', message: 'Invalid player.' };
  if (!Number.isInteger(power) || power < 1 || power > 5) {
    return { error: 'INVALID_ACTION', message: 'Choose a power between 1 and 5.' };
  }
  if (!state || !Number.isInteger(state.holeIndex) || !Array.isArray(state.distances) || !Array.isArray(state.strokes) || !Array.isArray(state.scores)) {
    return { error: 'INVALID_ACTION', message: 'The Mini Golf match state is invalid.' };
  }
  // Matches created before map selection safely use the original course.
  const map = getMiniGolfMap(state.mapId || 'sunset-links');
  const hole = miniGolfHole(map?.id, state.holeIndex);
  if (!map || !hole || state.distances.length !== 2 || state.strokes.length !== 2) {
    return { error: 'INVALID_ACTION', message: 'The current hole is invalid.' };
  }

  const playerIndex = player - 1;
  const holeScore = state.scores[state.holeIndex] || [null, null];
  if (holeScore[playerIndex] !== null) return { error: 'INVALID_ACTION', message: 'You have already finished this hole.' };
  const strokes = [...state.strokes];
  const distances = [...state.distances];
  strokes[playerIndex] += 1;
  const travel = Math.max(5, power * 10 + hole.wind);
  distances[playerIndex] = Math.max(0, distances[playerIndex] - travel);
  const scores = state.scores.map((score) => [...score]);
  if (distances[playerIndex] === 0) scores[state.holeIndex] = playerIndex === 0 ? [strokes[playerIndex], holeScore[1]] : [holeScore[0], strokes[playerIndex]];

  const updatedState = { ...state, mapId: map.id, distances, strokes, scores };
  const completeHole = updatedState.scores[state.holeIndex]?.every((score) => Number.isInteger(score));
  if (!completeHole) {
    return { state: updatedState, completed: false, nextPlayerMark: player === 1 ? 2 : 1 };
  }

  const isFinalHole = state.holeIndex === map.holes.length - 1;
  if (isFinalHole) {
    const totals = [0, 1].map((index) => updatedState.scores.reduce((total, score) => total + score[index], 0));
    return {
      state: { ...updatedState, totals },
      completed: true,
      draw: totals[0] === totals[1],
      winnerMark: totals[0] === totals[1] ? null : totals[0] < totals[1] ? 1 : 2,
      nextPlayerMark: null,
    };
  }

  const nextHoleIndex = state.holeIndex + 1;
  const nextHole = map.holes[nextHoleIndex];
  return {
    state: { ...updatedState, holeIndex: nextHoleIndex, distances: [nextHole.distance, nextHole.distance], strokes: [0, 0] },
    completed: false,
    nextPlayerMark: 1,
  };
}
