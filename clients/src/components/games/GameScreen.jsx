import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { acceptGameMatch, createGameMatch, declineGameMatch, fetchGameMatch, forfeitGameMatch, submitGameAction } from '../../apis/games';

function playerName(player) { return player?.name || 'Player'; }
function gameName(gameType) {
  return ({ 'mini-golf': 'Mini Golf', 'tic-tac-toe': 'Tic-Tac-Toe', knockout: 'Knockout', 'crazy-8-ball': 'Crazy 8 Ball', 'word-hunt': 'Word Hunt', filler: 'Filler' })[gameType] || 'Game';
}

const FILLER_COLORS = {
  coral: '#f27672',
  gold: '#edc85f',
  mint: '#5bc79c',
  sky: '#64b7e8',
  violet: '#a184e8',
  rose: '#e987b7',
};

// Both players tee off from the same server-authoritative position. Offset only
// their visual markers while they overlap so it is always obvious which ball
// belongs to the active player. Game physics continue to use the true position.
function displayBallPositions(balls) {
  if (!Array.isArray(balls) || balls.length !== 2) return balls || [];
  const [first, second] = balls;
  if (Math.hypot(first.x - second.x, first.y - second.y) > 4) return balls;
  return [
    { ...first, x: first.x - 16, y: first.y },
    { ...second, x: second.x + 16, y: second.y },
  ];
}

function movingObstacleRects(hole, seconds) {
  return (hole.movingObstacles || []).flatMap((obstacle) => {
    const phase = seconds * (obstacle.speed || 1) + (obstacle.phase || 0);
    const offset = obstacle.type === 'circle'
      ? { x: Math.sin(phase) * obstacle.radius, y: Math.cos(phase) * obstacle.radius }
      : { x: Math.sin(phase) * (obstacle.amplitude?.x || 0), y: Math.sin(phase) * (obstacle.amplitude?.y || 0) };
    const pieces = obstacle.pieces || [{ x: -(obstacle.size?.width || 0) / 2, y: -(obstacle.size?.height || 0) / 2, width: obstacle.size?.width, height: obstacle.size?.height }];
    return pieces.map((piece, index) => ({ key: `${obstacle.id}-${index}`, x: obstacle.origin.x + offset.x + piece.x, y: obstacle.origin.y + offset.y + piece.y, width: piece.width, height: piece.height }));
  });
}

function useLiveObstacleTime(enabled) {
  const [seconds, setSeconds] = useState(() => Date.now() / 1000);
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => setSeconds(Date.now() / 1000), 125);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return seconds;
}

function SvgCourse({ hole, balls, playerIndex, aim, canShoot, maxPullDistance, onAimStart, onAimMove, onAimEnd, onAimCancel, obstacleTime, boardRef }) {
  const width = hole.bounds?.width || 1200;
  const height = hole.bounds?.height || 700;
  const ball = balls[aim?.playerIndex || 0];
  const displayBalls = displayBallPositions(balls);
  const dx = aim ? ball.x - aim.x : 0;
  const dy = aim ? ball.y - aim.y : 0;
  const pullLength = Math.hypot(dx, dy);
  const limitedPullLength = Math.min(maxPullDistance, pullLength);
  const direction = pullLength > 0 ? { x: dx / pullLength, y: dy / pullLength } : { x: 1, y: 0 };
  const pullPoint = { x: ball.x - direction.x * limitedPullLength, y: ball.y - direction.y * limitedPullLength };
  const power = Math.round((limitedPullLength / maxPullDistance) * 100);
  const previewLength = 90 + (limitedPullLength / maxPullDistance) * 210;
  const preview = { x: ball.x + direction.x * previewLength, y: ball.y + direction.y * previewLength };
  const arrowBase = { x: preview.x - direction.x * 22, y: preview.y - direction.y * 22 };
  const arrowLeft = { x: arrowBase.x + direction.y * 11, y: arrowBase.y - direction.x * 11 };
  const arrowRight = { x: arrowBase.x - direction.y * 11, y: arrowBase.y + direction.x * 11 };

  return <svg ref={boardRef} className='mini-golf-board' viewBox={`0 0 ${width} ${height}`} role='img' aria-label={`${hole.name} Mini Golf hole`}>
    <rect className='mini-golf-grass' x='0' y='0' width={width} height={height} rx='28' />
    {(hole.ice || []).map((zone, index) => <rect className='mini-golf-ice' key={`ice-${index}`} {...zone} rx='18' />)}
    {(hole.sand || []).map((zone, index) => <ellipse className='mini-golf-sand' key={`sand-${index}`} cx={zone.x} cy={zone.y} rx={zone.rx} ry={zone.ry} />)}
    {(hole.water || []).map((zone, index) => <ellipse className='mini-golf-water' key={`water-${index}`} cx={zone.x} cy={zone.y} rx={zone.rx} ry={zone.ry} />)}
    {(hole.slopes || []).map((zone, index) => <rect className='mini-golf-slope' key={`slope-${index}`} {...zone} rx='14' />)}
    {(hole.walls || []).map((wall, index) => <rect className='mini-golf-wall' key={`wall-${index}`} {...wall} rx='8' />)}
    {movingObstacleRects(hole, obstacleTime).map((wall) => <rect className='mini-golf-moving-wall' key={wall.key} {...wall} rx='4' />)}
    <rect className='mini-golf-cup-shadow' x={hole.cup.x - 29} y={hole.cup.y - 29} width='58' height='58' rx='5' />
    <rect className='mini-golf-cup' x={hole.cup.x - 25} y={hole.cup.y - 25} width='50' height='50' rx='3' />
    {aim && <g className='mini-golf-aim-guide'><line className='mini-golf-aim-shot-shadow' x1={ball.x} y1={ball.y} x2={preview.x} y2={preview.y} /><line className='mini-golf-aim-shot' x1={ball.x} y1={ball.y} x2={preview.x} y2={preview.y} /><polygon className='mini-golf-aim-arrow' points={`${preview.x},${preview.y} ${arrowLeft.x},${arrowLeft.y} ${arrowRight.x},${arrowRight.y}`} /><line className='mini-golf-cue-stick' x1={ball.x} y1={ball.y} x2={pullPoint.x} y2={pullPoint.y} /><circle className='mini-golf-cue-grip' cx={pullPoint.x} cy={pullPoint.y} r='15' /><g className='mini-golf-power-meter' transform={`translate(${ball.x - 49} ${ball.y - 62})`}><rect width='98' height='22' rx='11' /><rect className='mini-golf-power-fill' width={90 * (power / 100)} height='14' x='4' y='4' rx='7' /><text x='49' y='16'>{power}% power</text></g></g>}
    {canShoot && <><circle className='mini-golf-ball-active-ring' cx={displayBalls[playerIndex].x} cy={displayBalls[playerIndex].y} r='24' /><text className='mini-golf-ball-label' x={displayBalls[playerIndex].x} y={displayBalls[playerIndex].y - 31}>Your ball</text></>}
    <circle className='mini-golf-ball mini-golf-ball-one' cx={displayBalls[0].x} cy={displayBalls[0].y} r='13' />
    <circle className='mini-golf-ball mini-golf-ball-two' cx={displayBalls[1].x} cy={displayBalls[1].y} r='13' />
    {/* A transparent hit layer avoids browser-specific SVG child hit testing. */}
    <rect className='mini-golf-hit-area' x='0' y='0' width={width} height={height} fill='transparent' onPointerDown={canShoot ? onAimStart : undefined} onPointerMove={onAimMove} onPointerUp={onAimEnd} onPointerCancel={onAimCancel} onLostPointerCapture={onAimCancel} />
  </svg>;
}

function MiniGolfCourse({ match, activeUserId, acting, onShot }) {
  const boardRef = useRef(null);
  const [aim, setAim] = useState(null);
  const aimRef = useRef(null);
  const maxPullDistance = 220;
  const ballHitRadius = 60;
  const state = match?.authoritativeState;
  const course = Array.isArray(match?.gameConfig?.course) ? match.gameConfig.course : [];
  const obstacleTime = useLiveObstacleTime(match?.status === 'ACTIVE');

  // A match opened from an older invitation may briefly lack its complete
  // server snapshot. Keep the dialog usable rather than throwing and taking
  // down the entire React tree.
  if (!state || !Number.isInteger(state.holeIndex) || !Array.isArray(state.balls) || !Array.isArray(state.strokes) || !Array.isArray(state.scores)) {
    return <p className='game-result'>Loading the Mini Golf course…</p>;
  }

  const hole = course[state.holeIndex];
  const playerIndex = match.player1?._id === activeUserId ? 0 : 1;
  const score = state.scores?.[state.holeIndex]?.[playerIndex] ?? null;
  const canShoot = Boolean(hole && Array.isArray(state.balls) && match.status === 'ACTIVE' && match.activePlayerId === activeUserId && score === null && !acting);

  const pointForEvent = (event) => {
    const rect = boardRef.current.getBoundingClientRect();
    const width = hole?.bounds?.width || 1200;
    const height = hole?.bounds?.height || 700;
    return { x: Math.max(0, Math.min(width, (event.clientX - rect.left) * (width / rect.width))), y: Math.max(0, Math.min(height, (event.clientY - rect.top) * (height / rect.height))) };
  };
  const updateAim = (nextAim) => {
    aimRef.current = nextAim;
    setAim(nextAim);
  };
  const startAim = (event) => {
    if (!canShoot) return;
    const pointer = pointForEvent(event);
    const ball = state.balls[playerIndex];
    if (Math.hypot(pointer.x - ball.x, pointer.y - ball.y) > ballHitRadius) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    // Track the pointer directly. This makes the displayed pull line match the
    // actual shot direction on mouse and touch input.
    updateAim({ x: pointer.x, y: pointer.y, playerIndex, pointerId: event.pointerId });
  };
  const moveAim = (event) => {
    const current = aimRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    const pointer = pointForEvent(event);
    updateAim({ ...current, x: pointer.x, y: pointer.y });
  };
  const finishAim = (event) => {
    const current = aimRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    const pointer = pointForEvent(event);
    const ball = state.balls[current.playerIndex];
    const dx = ball.x - pointer.x;
    const dy = ball.y - pointer.y;
    const distance = Math.hypot(dx, dy);
    updateAim(null);
    if (distance < 14) return;
    onShot({ angle: Math.atan2(dy, dx), power: Math.min(1, distance / maxPullDistance) });
  };
  const cancelAim = (event) => {
    if (aimRef.current?.pointerId === event.pointerId) updateAim(null);
  };

  if (!hole || state.balls.length !== 2 || state.strokes.length !== 2) return <p className='game-result'>This Mini Golf match uses retired rules. Start a new match to play the updated course game.</p>;
  const scores = state.scores.map((item) => `${item[0] ?? '-'} / ${item[1] ?? '-'}`);
  const activePlayer = match.activePlayerId === match.player1?._id ? match.player1 : match.player2;
  const playerOnePutting = match.activePlayerId === match.player1?._id && state.scores?.[state.holeIndex]?.[0] === null;
  const playerTwoPutting = match.activePlayerId === match.player2?._id && state.scores?.[state.holeIndex]?.[1] === null;
  const feedback = state.lastShot?.pickedUp ? 'Stroke limit reached: level recorded as 8.' : state.lastShot?.sunk ? 'Nice putt - ball in the red box!' : canShoot ? 'Grab the glowing ball, pull straight back, then release to putt.' : `${playerName(activePlayer)} is completing this hole.`;

  return <div className='mini-golf-course'>
    <div className='mini-golf-map-name'>{match.gameConfig?.mapName || 'Course'} · Classic five-level mode</div>
    <div className='mini-golf-meta'><b>{hole.name} - Hole {state.holeIndex + 1} of {match.gameConfig?.holes || 3}</b><span>Par {hole.par}</span></div>
    <div className={`mini-golf-board-wrap mini-golf-theme-${match.gameConfig?.theme || 'classic'}`}><SvgCourse boardRef={boardRef} hole={hole} balls={state.balls} playerIndex={playerIndex} aim={aim} canShoot={canShoot} maxPullDistance={maxPullDistance} onAimStart={startAim} onAimMove={moveAim} onAimEnd={finishAim} onAimCancel={cancelAim} obstacleTime={obstacleTime} /></div>
    <div className='mini-golf-stats'><div><b>{playerName(match.player1)}</b><span>{state.strokes[0]} strokes {playerOnePutting ? '- completing hole' : ''}</span></div><div><b>{playerName(match.player2)}</b><span>{state.strokes[1]} strokes {playerTwoPutting ? '- completing hole' : ''}</span></div></div>
    <p className='mini-golf-score'>Hole scores: {scores.length ? scores.join(' - ') : 'No completed holes yet'}</p>
    <p className='mini-golf-help'>{feedback}</p>
  </div>;
}

function TicTacToeBoard({ match, activeUserId, acting, onMove }) {
  const board = match?.authoritativeState?.board;
  if (!Array.isArray(board) || board.length !== 9) return <p className='game-result'>Loading the match board…</p>;

  return <div className='tic-tac-toe-board' aria-label='Tic-Tac-Toe board'>{board.map((mark, cell) => <button key={cell} type='button' disabled={acting || match.status !== 'ACTIVE' || match.activePlayerId !== activeUserId || Boolean(mark)} onClick={() => onMove(cell)} aria-label={`Square ${cell + 1}`} className={mark === 1 ? 'mark-x' : mark === 2 ? 'mark-o' : ''}>{mark === 1 ? 'X' : mark === 2 ? 'O' : ''}</button>)}</div>;
}

function FillerBoard({ match, activeUserId, acting, onAction }) {
  const state = match.authoritativeState;
  if (!Array.isArray(state?.board) || !Array.isArray(state?.owners)) return <p className='game-result'>Loading the Filler board...</p>;
  const colors = Object.keys(FILLER_COLORS);
  const mine = match.player1?._id === activeUserId ? 1 : 2;
  const canPlay = match.activePlayerId === activeUserId && !acting;
  return <div className='arcade-game'><div className='filler-board'>{state.board.map((row, rowIndex) => row.map((color, columnIndex) => <span key={`${rowIndex}-${columnIndex}`} className={`filler-cell filler-${color} filler-owner-${state.owners[rowIndex][columnIndex]}`} />))}</div><div className='filler-colors' aria-label='Choose a colour'>{colors.map((color) => <button key={color} type='button' className={`filler-choice filler-${color}`} style={{ backgroundColor: FILLER_COLORS[color] }} disabled={!canPlay || state.playerColors.includes(color)} onClick={() => onAction('COLOR', { color })} aria-label={`Choose ${color}`} title={state.playerColors.includes(color) ? `${color} is already owned` : `Choose ${color}`} />)}</div><p className='game-result'>{canPlay ? `Choose a colour that neither player owns. You control ${state.playerColors[mine - 1]}.` : `${playerName(match.activePlayerId === match.player1?._id ? match.player1 : match.player2)} is choosing a colour.`}</p></div>;
}

function WordHuntBoard({ match, activeUserId, acting, onAction }) {
  const state = match.authoritativeState;
  const [path, setPath] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => setPath([]), [match.revision]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  if (!Array.isArray(state?.board)) return <p className='game-result'>Loading the Word Hunt board...</p>;
  const canPlay = match.activePlayerId === activeUserId && !acting;
  const selected = new Set(path.map((item) => `${item.row}-${item.column}`));
  const add = (row, column) => { if (!canPlay || selected.has(`${row}-${column}`)) return; const previous = path[path.length - 1]; if (previous && Math.max(Math.abs(previous.row - row), Math.abs(previous.column - column)) !== 1) return; setPath((current) => [...current, { row, column }]); };
  const word = path.map(({ row, column }) => state.board[row][column]).join('');
  const turnPlayerMark = state.turnPlayerMark === 2 ? 2 : 1;
  const turnPlayer = turnPlayerMark === 1 ? match.player1 : match.player2;
  const turnEndsAt = state.turnEndsAt || state.roundEndsAt;
  const secondsLeft = turnEndsAt ? Math.max(0, Math.ceil((new Date(turnEndsAt).getTime() - now) / 1000)) : null;
  return <div className='arcade-game'><div className='word-hunt-score'><span>{playerName(match.player1)}: {state.scores?.[0] || 0}</span><b>{secondsLeft === null ? 'Round starts when accepted' : `${playerName(turnPlayer)}'s turn · ${secondsLeft}s`}</b><span>{playerName(match.player2)}: {state.scores?.[1] || 0}</span></div><div className='word-hunt-board'>{state.board.map((row, rowIndex) => row.map((letter, columnIndex) => <button key={`${rowIndex}-${columnIndex}`} type='button' className={selected.has(`${rowIndex}-${columnIndex}`) ? 'word-selected' : ''} disabled={!canPlay || secondsLeft === 0} onClick={() => add(rowIndex, columnIndex)}>{letter}</button>))}</div><div className='word-controls'><b>{word || 'Select connected letters'}</b><button type='button' disabled={!canPlay || secondsLeft === 0 || path.length < 3} onClick={() => onAction('WORD', { path })}>Submit word</button><button type='button' onClick={() => setPath([])}>Clear</button></div><p className='game-result'>{canPlay ? 'Find as many unique words as you can before your two minutes end.' : `${playerName(turnPlayer)} has this two-minute turn. A word can only be claimed once.`}</p></div>;
}

function pointOnPhysicsBoard(event, boardRef) {
  const bounds = boardRef.current?.getBoundingClientRect();
  if (!bounds) return null;
  return { x: Math.max(0, Math.min(1000, (event.clientX - bounds.left) * (1000 / bounds.width))), y: Math.max(0, Math.min(600, (event.clientY - bounds.top) * (600 / bounds.height))) };
}

function PullBackCueGame({ match, activeUserId, acting, onAction }) {
  const boardRef = useRef(null);
  const aimRef = useRef(null);
  const [aim, setAim] = useState(null);
  const state = match.authoritativeState;
  const cue = state?.balls?.find((ball) => ball.id === 'cue');
  const canShoot = match.activePlayerId === activeUserId && !acting;
  if (!cue) return <p className='game-result'>Loading the pool table...</p>;
  const startAim = (event) => {
    if (!canShoot) return;
    const point = pointOnPhysicsBoard(event, boardRef);
    if (!point || Math.hypot(point.x - cue.x, point.y - cue.y) > 48) return;
    event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId);
    const next = { pointerId: event.pointerId, x: cue.x, y: cue.y }; aimRef.current = next; setAim(next);
  };
  const moveAim = (event) => {
    const current = aimRef.current; if (!current || current.pointerId !== event.pointerId) return;
    const point = pointOnPhysicsBoard(event, boardRef); if (!point) return;
    event.preventDefault(); const next = { ...current, x: point.x, y: point.y }; aimRef.current = next; setAim(next);
  };
  const finishAim = (event) => {
    const current = aimRef.current; if (!current || current.pointerId !== event.pointerId) return;
    const point = pointOnPhysicsBoard(event, boardRef); aimRef.current = null; setAim(null); if (!point) return;
    const dx = cue.x - point.x; const dy = cue.y - point.y; const pull = Math.hypot(dx, dy);
    if (pull >= 14) onAction('SHOT', { angle: Math.atan2(dy, dx), power: Math.min(1, pull / 170) });
  };
  const preview = aim ? { x: cue.x + (cue.x - aim.x) * .75, y: cue.y + (cue.y - aim.y) * .75 } : null;
  return <div className='arcade-game'><svg ref={boardRef} className='physics-board pool-board' viewBox='0 0 1000 600' role='img' aria-label='8 ball table' onPointerDown={startAim} onPointerMove={moveAim} onPointerUp={finishAim} onPointerCancel={() => { aimRef.current = null; setAim(null); }}>
    {[[20,20],[500,20],[980,20],[20,560],[500,560],[980,560]].map(([x,y]) => <circle className='pool-pocket' key={`${x}-${y}`} cx={x} cy={y} r='24' />)}
    {aim && <><line className='physics-aim-pull' x1={cue.x} y1={cue.y} x2={aim.x} y2={aim.y} /><line className='physics-aim-shot' x1={cue.x} y1={cue.y} x2={preview.x} y2={preview.y} /></>}
    {state.balls.map((ball) => <circle key={ball.id} className={`pool-ball pool-${ball.kind}`} cx={ball.x} cy={ball.y} r='16' />)}
  </svg><p className='game-result'>{canShoot ? 'Touch or click the cue ball, pull back, and release to shoot.' : 'Wait for your turn.'}</p></div>;
}

function KnockoutGame({ match, activeUserId, acting, onAction }) {
  const boardRef = useRef(null);
  const aimRef = useRef(null);
  const [aim, setAim] = useState(null);
  const [plans, setPlans] = useState({});
  const state = match.authoritativeState;
  const mine = match.player1?._id === activeUserId ? 1 : 2;
  const canPlan = match.activePlayerId === activeUserId && !acting && !state?.plans?.[mine];
  const pieces = Array.isArray(state?.pieces) ? state.pieces : [];
  const myPieces = pieces.filter((piece) => piece.owner === mine);
  useEffect(() => { setPlans({}); aimRef.current = null; setAim(null); }, [match.revision]);
  if (myPieces.length !== 3) return <p className='game-result'>The round is over. Waiting for the saved result...</p>;
  const startAim = (event) => {
    if (!canPlan) return;
    const point = pointOnPhysicsBoard(event, boardRef); if (!point) return;
    const piece = myPieces.find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= 36);
    if (!piece) return;
    event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId);
    const next = { pointerId: event.pointerId, pieceId: piece.id, pieceX: piece.x, pieceY: piece.y, x: piece.x, y: piece.y }; aimRef.current = next; setAim(next);
  };
  const moveAim = (event) => {
    const current = aimRef.current; if (!current || current.pointerId !== event.pointerId) return;
    const point = pointOnPhysicsBoard(event, boardRef); if (!point) return;
    event.preventDefault(); const next = { ...current, x: point.x, y: point.y }; aimRef.current = next; setAim(next);
  };
  const finishAim = (event) => {
    const current = aimRef.current; if (!current || current.pointerId !== event.pointerId) return;
    const point = pointOnPhysicsBoard(event, boardRef); aimRef.current = null; setAim(null); if (!point) return;
    const piece = myPieces.find((item) => item.id === current.pieceId); const dx = piece.x - point.x; const dy = piece.y - point.y; const pull = Math.hypot(dx, dy);
    if (pull < 14) return;
    setPlans((currentPlans) => ({ ...currentPlans, [piece.id]: { pieceId: piece.id, angle: Math.atan2(dy, dx), power: Math.min(1, pull / 165) } }));
  };
  const submitPlans = () => onAction('PLAN', { plans: Object.values(plans) });
  const radius = state?.islandRadius || 270;
  const aimPiece = aim ? pieces.find((piece) => piece.id === aim.pieceId) : null;
  return <div className='arcade-game'><div className='knockout-status'><b>Round {(state?.round || 0) + 1}</b><span>Ice island shrinks after each round</span></div><svg ref={boardRef} className='physics-board knockout-board' viewBox='0 0 1000 600' role='img' aria-label='Shrinking icy Knockout island' onPointerDown={startAim} onPointerMove={moveAim} onPointerUp={finishAim} onPointerCancel={() => { aimRef.current = null; setAim(null); }}>
    <circle className='knockout-island' cx='500' cy='300' r={radius} />
    {Object.values(plans).map((plan) => { const piece = pieces.find((item) => item.id === plan.pieceId); return piece ? <line key={plan.pieceId} className='knockout-planned-shot' x1={piece.x} y1={piece.y} x2={piece.x + Math.cos(plan.angle) * (55 + plan.power * 80)} y2={piece.y + Math.sin(plan.angle) * (55 + plan.power * 80)} /> : null; })}
    {aim && aimPiece && <><line className='physics-aim-pull' x1={aimPiece.x} y1={aimPiece.y} x2={aim.x} y2={aim.y} /><line className='physics-aim-shot' x1={aimPiece.x} y1={aimPiece.y} x2={aimPiece.x + (aimPiece.x - aim.x) * .75} y2={aimPiece.y + (aimPiece.y - aim.y) * .75} /></>}
    {pieces.map((piece) => <circle key={piece.id} className={`knockout-piece knockout-owner-${piece.owner} ${plans[piece.id] ? 'knockout-planned' : ''}`} cx={piece.x} cy={piece.y} r='18' />)}
  </svg><div className='knockout-controls'><span>{Object.keys(plans).length}/3 seals planned</span><button type='button' disabled={!canPlan || Object.keys(plans).length !== 3} onClick={submitPlans}>Lock in all 3 moves</button><button type='button' disabled={!canPlan || !Object.keys(plans).length} onClick={() => setPlans({})}>Clear plans</button></div><p className='game-result'>{canPlan ? 'Pull back each of your three seals, then lock in the round.' : state?.plans?.[mine] ? 'Moves locked. Waiting for the other player to lock theirs.' : 'Wait for your turn to plan.'}</p></div>;
}

function PhysicsGame({ match, activeUserId, acting, onAction }) {
  const state = match.authoritativeState;
  const [angle, setAngle] = useState(0);
  const [power, setPower] = useState(.55);
  const [pieceId, setPieceId] = useState(null);
  const isKnockout = match.gameType === 'knockout';
  const canPlay = match.activePlayerId === activeUserId && !acting;
  const mine = match.player1?._id === activeUserId ? 1 : 2;
  const balls = isKnockout ? state?.pieces : state?.balls;
  if (!isKnockout) return <PullBackCueGame match={match} activeUserId={activeUserId} acting={acting} onAction={onAction} />;
  if (!Array.isArray(balls)) return <p className='game-result'>Loading the table...</p>;
  const selectedPiece = pieceId || (isKnockout ? balls.find((piece) => piece.owner === mine)?.id : 'cue');
  return <div className='arcade-game'><svg className={`physics-board ${isKnockout ? 'knockout-board' : 'pool-board'}`} viewBox='0 0 1000 600' role='img' aria-label={isKnockout ? 'Knockout ice arena' : '8 ball table'}>{!isKnockout && [[20,20],[500,20],[980,20],[20,560],[500,560],[980,560]].map(([x,y]) => <circle className='pool-pocket' key={`${x}-${y}`} cx={x} cy={y} r='24' />)}{balls.map((piece) => <circle key={piece.id} className={isKnockout ? `knockout-piece knockout-owner-${piece.owner} ${selectedPiece === piece.id ? 'physics-selected' : ''}` : `pool-ball pool-${piece.kind}`} cx={piece.x} cy={piece.y} r={isKnockout ? 18 : 16} onClick={() => isKnockout && piece.owner === mine && setPieceId(piece.id)} />)}</svg><div className='physics-controls'><label>Aim <input type='range' min='-3.14' max='3.14' step='.05' value={angle} onChange={(event) => setAngle(Number(event.target.value))} /></label><label>Power <input type='range' min='.1' max='1' step='.05' value={power} onChange={(event) => setPower(Number(event.target.value))} /></label><button type='button' disabled={!canPlay} onClick={() => onAction(isKnockout ? 'PUSH' : 'SHOT', isKnockout ? { pieceId: selectedPiece, angle, power } : { angle, power })}>{isKnockout ? 'Launch seal' : 'Take shot'}</button></div><p className='game-result'>{isKnockout ? 'Choose one of your seals, then set direction and power.' : 'Use the sliders to set a server-checked cue shot.'}</p></div>;
}

function NativeArcadeGame({ match, activeUserId, acting, onAction }) {
  if (match.gameType === 'filler') return <FillerBoard match={match} activeUserId={activeUserId} acting={acting} onAction={onAction} />;
  if (match.gameType === 'word-hunt') return <WordHuntBoard match={match} activeUserId={activeUserId} acting={acting} onAction={onAction} />;
  if (match.gameType === 'knockout') return <KnockoutGame match={match} activeUserId={activeUserId} acting={acting} onAction={onAction} />;
  return <PhysicsGame match={match} activeUserId={activeUserId} acting={acting} onAction={onAction} />;
}

export default function GameScreen({ matchId, initialMatch = null, activeUserId, onClose }) {
  const hasInitialMatch = initialMatch?.id === matchId;
  const [match, setMatch] = useState(() => hasInitialMatch ? initialMatch : null);
  const [loading, setLoading] = useState(() => !hasInitialMatch);
  const [acting, setActing] = useState(false);
  const refresh = useCallback(async (quiet = false) => { try { setMatch(await fetchGameMatch(matchId)); } catch (error) { if (!quiet) toast.error(error.response?.data?.message || 'Unable to load this match.'); } finally { setLoading(false); } }, [matchId]);

  useEffect(() => {
    if (!hasInitialMatch) refresh();
    const refreshInterval = match?.gameType === 'word-hunt' && match.status === 'ACTIVE' ? 30_000 : 45_000;
    const syncMatch = () => {
      if (document.visibilityState === 'visible') refresh(true);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncMatch();
    };
    const timer = window.setInterval(syncMatch, refreshInterval);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [hasInitialMatch, match?.gameType, match?.status, refresh]);
  const answerInvite = async (accept) => { setActing(true); try { setMatch(await (accept ? acceptGameMatch(matchId) : declineGameMatch(matchId))); } catch (error) { toast.error(error.response?.data?.message || 'Unable to update the invitation.'); } finally { setActing(false); } };
  const submitAction = async (actionType, actionPayload) => { if (!match || acting || match.activePlayerId !== activeUserId) return; setActing(true); try { setMatch(await submitGameAction(match, actionType, actionPayload)); } catch (error) { toast.error(error.response?.data?.message || 'That action was not accepted.'); await refresh(true); } finally { setActing(false); } };
  const forfeit = async () => { if (!window.confirm('Forfeit this match?')) return; setActing(true); try { setMatch(await forfeitGameMatch(matchId)); } catch (error) { toast.error(error.response?.data?.message || 'Unable to forfeit the match.'); } finally { setActing(false); } };
  const rematch = async () => { if (!match || acting) return; setActing(true); try { const { match: next } = await createGameMatch(match.conversationId, match.gameType, match.gameConfig?.mapId); onClose({ id: next.id, initialMatch: next }); } catch (error) { toast.error(error.response?.data?.message || 'Unable to start a rematch.'); } finally { setActing(false); } };

  const status = !match ? '' : match.status === 'ACTIVE' ? (match.activePlayerId === activeUserId ? 'Your turn' : `${playerName(match.activePlayerId === match.player1?._id ? match.player1 : match.player2)}'s turn`) : match.status === 'COMPLETED' ? `${playerName(match.winnerId === match.player1?._id ? match.player1 : match.player2)} won` : match.status === 'DRAW' ? 'Draw' : match.status === 'INVITED' ? 'Invitation waiting' : match.status === 'EXPIRED' ? 'Invitation expired after one hour' : 'Match closed';
  // The server calculates this from the authenticated session. Do not infer it
  // from client-side ids: a stale profile can otherwise expose invitation
  // controls to the match creator.
  const isInvitee = match?.viewerRole === 'INVITEE';
  const isMiniGolf = match?.gameType === 'mini-golf';
  const isTicTacToe = match?.gameType === 'tic-tac-toe';

  return <div className='game-screen-backdrop' role='presentation'><section className={`game-screen ${isMiniGolf ? 'mini-golf-screen' : ''}`} role='dialog' aria-modal='true' aria-label={`${gameName(match?.gameType)} match`}>
    <div className='game-screen-top'><header><div><span className='game-eyebrow'>GAMES</span><h2>{gameName(match?.gameType)}</h2><p>{status}</p></div><button type='button' onClick={onClose} aria-label='Return to chat'>x</button></header>
      {match && <div className='game-players'><span className={match.activePlayerId === match.player1?._id ? 'game-player-active' : ''}>{playerName(match.player1)} <b>{isMiniGolf ? '1' : 'X'}</b></span><span className={match.activePlayerId === match.player2?._id ? 'game-player-active' : ''}>{playerName(match.player2)} <b>{isMiniGolf ? '2' : 'O'}</b></span></div>}</div>
    {loading ? <div className='game-loading'>Loading match...</div> : match && <>
      {match.status === 'INVITED' && isInvitee && <div className='game-invite-actions'><button type='button' disabled={acting} onClick={() => answerInvite(true)}>Accept</button><button type='button' disabled={acting} onClick={() => answerInvite(false)}>Decline</button></div>}
      {match.status === 'INVITED' && !isInvitee && <p className='game-waiting'>Waiting for {playerName(match.player2)} to accept.</p>}
      {match.status !== 'INVITED' && (isMiniGolf ? <MiniGolfCourse match={match} activeUserId={activeUserId} acting={acting} onShot={(shot) => submitAction('SHOT', shot)} /> : isTicTacToe ? <TicTacToeBoard match={match} activeUserId={activeUserId} acting={acting} onMove={(cell) => submitAction('MOVE', { cell })} /> : <NativeArcadeGame match={match} activeUserId={activeUserId} acting={acting} onAction={submitAction} />)}
      {match.status === 'ACTIVE' && <button type='button' className='game-forfeit' onClick={forfeit} disabled={acting}>Forfeit match</button>}
      {match.status !== 'ACTIVE' && match.status !== 'INVITED' && <div className='game-result'>{match.status === 'EXPIRED' ? 'This unanswered invitation expired after one hour.' : 'This result is saved in your conversation.'}<button type='button' className='game-rematch' disabled={acting} onClick={rematch}>Request rematch</button></div>}</>}
  </section></div>;
}
