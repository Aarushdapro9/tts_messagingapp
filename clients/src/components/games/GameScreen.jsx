import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { acceptGameMatch, declineGameMatch, fetchGameMatch, forfeitGameMatch, submitGameAction } from '../../apis/games';

function playerName(player) { return player?.name || 'Player'; }
function gameName(gameType) { return gameType === 'mini-golf' ? 'Mini Golf' : 'Tic-Tac-Toe'; }

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
    const timer = window.setInterval(() => setSeconds(Date.now() / 1000), 80);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return seconds;
}

function SvgCourse({ hole, balls, playerIndex, aim, canShoot, onAimStart, onAimMove, onAimEnd, onAimCancel, obstacleTime, boardRef }) {
  const width = hole.bounds?.width || 1200;
  const height = hole.bounds?.height || 700;
  const ball = balls[aim?.playerIndex || 0];
  const displayBalls = displayBallPositions(balls);
  const dx = aim ? ball.x - aim.x : 0;
  const dy = aim ? ball.y - aim.y : 0;
  const pullLength = Math.hypot(dx, dy);
  const previewLength = Math.min(220, pullLength * 1.45);
  const preview = pullLength > 0 ? { x: ball.x + (dx / pullLength) * previewLength, y: ball.y + (dy / pullLength) * previewLength } : ball;

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
    {aim && <><line className='mini-golf-aim-pull' x1={ball.x} y1={ball.y} x2={aim.x} y2={aim.y} /><line className='mini-golf-aim-shot' x1={ball.x} y1={ball.y} x2={preview.x} y2={preview.y} /></>}
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
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    // Dragging can begin anywhere on the course. The pull distance is measured
    // from the active ball, which also keeps the control usable at small sizes.
    updateAim({ x: ball.x, y: ball.y, playerIndex, pointerId: event.pointerId, grabOffset: { x: pointer.x - ball.x, y: pointer.y - ball.y } });
  };
  const moveAim = (event) => {
    const current = aimRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    const pointer = pointForEvent(event);
    updateAim({ ...current, x: pointer.x - current.grabOffset.x, y: pointer.y - current.grabOffset.y });
  };
  const finishAim = (event) => {
    const current = aimRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    const pointer = pointForEvent(event);
    const pullPoint = { x: pointer.x - current.grabOffset.x, y: pointer.y - current.grabOffset.y };
    const ball = state.balls[current.playerIndex];
    const dx = ball.x - pullPoint.x;
    const dy = ball.y - pullPoint.y;
    const distance = Math.hypot(dx, dy);
    updateAim(null);
    if (distance < 14) return;
    onShot({ angle: Math.atan2(dy, dx), power: Math.min(1, distance / 170) });
  };
  const cancelAim = (event) => {
    if (aimRef.current?.pointerId === event.pointerId) updateAim(null);
  };

  if (!hole || state.balls.length !== 2 || state.strokes.length !== 2) return <p className='game-result'>This Mini Golf match uses retired rules. Start a new match to play the updated course game.</p>;
  const scores = state.scores.map((item) => `${item[0] ?? '-'} / ${item[1] ?? '-'}`);
  const feedback = state.lastShot?.pickedUp ? 'Stroke limit reached: level recorded as 8.' : state.lastShot?.sunk ? 'Nice putt - ball in the red box!' : canShoot ? 'Grab the glowing ball labelled “Your ball”, pull back, then release to putt.' : 'Wait for your turn to take a shot.';

  return <div className='mini-golf-course'>
    <div className='mini-golf-map-name'>{match.gameConfig?.mapName || 'Course'} · Classic five-level mode</div>
    <div className='mini-golf-meta'><b>{hole.name} - Hole {state.holeIndex + 1} of {match.gameConfig?.holes || 3}</b><span>Par {hole.par}</span></div>
    <div className={`mini-golf-board-wrap mini-golf-theme-${match.gameConfig?.theme || 'classic'}`}><SvgCourse boardRef={boardRef} hole={hole} balls={state.balls} playerIndex={playerIndex} aim={aim} canShoot={canShoot} onAimStart={startAim} onAimMove={moveAim} onAimEnd={finishAim} onAimCancel={cancelAim} obstacleTime={obstacleTime} /></div>
    <div className='mini-golf-stats'><div><b>{playerName(match.player1)}</b><span>{state.strokes[0]} strokes {score === null && playerIndex === 0 ? '- putting' : ''}</span></div><div><b>{playerName(match.player2)}</b><span>{state.strokes[1]} strokes {score === null && playerIndex === 1 ? '- putting' : ''}</span></div></div>
    <p className='mini-golf-score'>Hole scores: {scores.length ? scores.join(' - ') : 'No completed holes yet'}</p>
    <p className='mini-golf-help'>{feedback}</p>
  </div>;
}

function TicTacToeBoard({ match, activeUserId, acting, onMove }) {
  const board = match?.authoritativeState?.board;
  if (!Array.isArray(board) || board.length !== 9) return <p className='game-result'>Loading the match board…</p>;

  return <div className='tic-tac-toe-board' aria-label='Tic-Tac-Toe board'>{board.map((mark, cell) => <button key={cell} type='button' disabled={acting || match.status !== 'ACTIVE' || match.activePlayerId !== activeUserId || Boolean(mark)} onClick={() => onMove(cell)} aria-label={`Square ${cell + 1}`} className={mark === 1 ? 'mark-x' : mark === 2 ? 'mark-o' : ''}>{mark === 1 ? 'X' : mark === 2 ? 'O' : ''}</button>)}</div>;
}

export default function GameScreen({ matchId, initialMatch = null, activeUserId, onClose }) {
  const hasInitialMatch = initialMatch?.id === matchId;
  const [match, setMatch] = useState(() => hasInitialMatch ? initialMatch : null);
  const [loading, setLoading] = useState(() => !hasInitialMatch);
  const [acting, setActing] = useState(false);
  const refresh = useCallback(async (quiet = false) => { try { setMatch(await fetchGameMatch(matchId)); } catch (error) { if (!quiet) toast.error(error.response?.data?.message || 'Unable to load this match.'); } finally { setLoading(false); } }, [matchId]);

  useEffect(() => { if (!hasInitialMatch) refresh(); const timer = window.setInterval(() => refresh(true), 30_000); return () => window.clearInterval(timer); }, [hasInitialMatch, refresh]);
  const answerInvite = async (accept) => { setActing(true); try { setMatch(await (accept ? acceptGameMatch(matchId) : declineGameMatch(matchId))); } catch (error) { toast.error(error.response?.data?.message || 'Unable to update the invitation.'); } finally { setActing(false); } };
  const submitAction = async (actionType, actionPayload) => { if (!match || acting || match.activePlayerId !== activeUserId) return; setActing(true); try { setMatch(await submitGameAction(match, actionType, actionPayload)); } catch (error) { toast.error(error.response?.data?.message || 'That action was not accepted.'); await refresh(true); } finally { setActing(false); } };
  const forfeit = async () => { if (!window.confirm('Forfeit this match?')) return; setActing(true); try { setMatch(await forfeitGameMatch(matchId)); } catch (error) { toast.error(error.response?.data?.message || 'Unable to forfeit the match.'); } finally { setActing(false); } };

  const status = !match ? '' : match.status === 'ACTIVE' ? (match.activePlayerId === activeUserId ? 'Your turn' : `${playerName(match.activePlayerId === match.player1?._id ? match.player1 : match.player2)}'s turn`) : match.status === 'COMPLETED' ? `${playerName(match.winnerId === match.player1?._id ? match.player1 : match.player2)} won` : match.status === 'DRAW' ? 'Draw' : match.status === 'INVITED' ? 'Invitation waiting' : match.status === 'EXPIRED' ? 'Invitation expired after one hour' : 'Match closed';
  // The server calculates this from the authenticated session. Do not infer it
  // from client-side ids: a stale profile can otherwise expose invitation
  // controls to the match creator.
  const isInvitee = match?.viewerRole === 'INVITEE';
  const isMiniGolf = match?.gameType === 'mini-golf';

  return <div className='game-screen-backdrop' role='presentation'><section className={`game-screen ${isMiniGolf ? 'mini-golf-screen' : ''}`} role='dialog' aria-modal='true' aria-label={`${gameName(match?.gameType)} match`}>
    <div className='game-screen-top'><header><div><span className='game-eyebrow'>GAMES</span><h2>{gameName(match?.gameType)}</h2><p>{status}</p></div><button type='button' onClick={onClose} aria-label='Return to chat'>x</button></header>
      {match && <div className='game-players'><span className={match.activePlayerId === match.player1?._id ? 'game-player-active' : ''}>{playerName(match.player1)} <b>{isMiniGolf ? '1' : 'X'}</b></span><span className={match.activePlayerId === match.player2?._id ? 'game-player-active' : ''}>{playerName(match.player2)} <b>{isMiniGolf ? '2' : 'O'}</b></span></div>}</div>
    {loading ? <div className='game-loading'>Loading match...</div> : match && <>
      {match.status === 'INVITED' && isInvitee && <div className='game-invite-actions'><button type='button' disabled={acting} onClick={() => answerInvite(true)}>Accept</button><button type='button' disabled={acting} onClick={() => answerInvite(false)}>Decline</button></div>}
      {match.status === 'INVITED' && !isInvitee && <p className='game-waiting'>Waiting for {playerName(match.player2)} to accept.</p>}
      {match.status !== 'INVITED' && (isMiniGolf ? <MiniGolfCourse match={match} activeUserId={activeUserId} acting={acting} onShot={(shot) => submitAction('SHOT', shot)} /> : <TicTacToeBoard match={match} activeUserId={activeUserId} acting={acting} onMove={(cell) => submitAction('MOVE', { cell })} />)}
      {match.status === 'ACTIVE' && <button type='button' className='game-forfeit' onClick={forfeit} disabled={acting}>Forfeit match</button>}
      {match.status !== 'ACTIVE' && match.status !== 'INVITED' && <p className='game-result'>{match.status === 'EXPIRED' ? 'This unanswered invitation expired after one hour.' : 'This result is saved in your conversation.'}</p>}</>}
  </section></div>;
}
