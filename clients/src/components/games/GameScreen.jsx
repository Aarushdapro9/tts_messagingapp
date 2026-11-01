import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { acceptGameMatch, declineGameMatch, fetchGameMatch, forfeitGameMatch, submitGameAction } from '../../apis/games';

function playerName(player) { return player?.name || 'Player'; }
function gameName(gameType) { return gameType === 'mini-golf' ? 'Mini Golf' : 'Tic-Tac-Toe'; }

function SvgCourse({ hole, balls, aim, canShoot, onAimStart, onAimMove, onAimEnd }) {
  const ball = balls[aim?.playerIndex || 0];
  const dx = aim ? ball.x - aim.x : 0;
  const dy = aim ? ball.y - aim.y : 0;
  const pullLength = Math.hypot(dx, dy);
  const previewLength = Math.min(220, pullLength * 1.45);
  const preview = pullLength > 0 ? { x: ball.x + (dx / pullLength) * previewLength, y: ball.y + (dy / pullLength) * previewLength } : ball;

  return <svg className='mini-golf-board' viewBox='0 0 1000 600' role='img' aria-label={`${hole.name} Mini Golf hole`} onPointerDown={canShoot ? onAimStart : undefined} onPointerMove={aim ? onAimMove : undefined} onPointerUp={aim ? onAimEnd : undefined} onPointerCancel={aim ? onAimEnd : undefined}>
    <rect className='mini-golf-grass' x='0' y='0' width='1000' height='600' rx='28' />
    {(hole.ice || []).map((zone, index) => <rect className='mini-golf-ice' key={`ice-${index}`} {...zone} rx='18' />)}
    {(hole.sand || []).map((zone, index) => <ellipse className='mini-golf-sand' key={`sand-${index}`} cx={zone.x} cy={zone.y} rx={zone.rx} ry={zone.ry} />)}
    {(hole.water || []).map((zone, index) => <ellipse className='mini-golf-water' key={`water-${index}`} cx={zone.x} cy={zone.y} rx={zone.rx} ry={zone.ry} />)}
    {(hole.slopes || []).map((zone, index) => <rect className='mini-golf-slope' key={`slope-${index}`} {...zone} rx='14' />)}
    {(hole.walls || []).map((wall, index) => <rect className='mini-golf-wall' key={`wall-${index}`} {...wall} rx='8' />)}
    <circle className='mini-golf-cup-shadow' cx={hole.cup.x} cy={hole.cup.y} r='24' />
    <circle className='mini-golf-cup' cx={hole.cup.x} cy={hole.cup.y} r='16' />
    <path className='mini-golf-pin' d={`M ${hole.cup.x} ${hole.cup.y - 18} L ${hole.cup.x} ${hole.cup.y - 92} L ${hole.cup.x + 58} ${hole.cup.y - 74} L ${hole.cup.x} ${hole.cup.y - 54}`} />
    {aim && <><line className='mini-golf-aim-pull' x1={ball.x} y1={ball.y} x2={aim.x} y2={aim.y} /><line className='mini-golf-aim-shot' x1={ball.x} y1={ball.y} x2={preview.x} y2={preview.y} /></>}
    <circle className='mini-golf-ball mini-golf-ball-one' cx={balls[0].x} cy={balls[0].y} r='13' />
    <circle className='mini-golf-ball mini-golf-ball-two' cx={balls[1].x} cy={balls[1].y} r='13' />
  </svg>;
}

function MiniGolfCourse({ match, activeUserId, acting, onShot }) {
  const boardRef = useRef(null);
  const [aim, setAim] = useState(null);
  const state = match.authoritativeState;
  const course = match.gameConfig?.course || [];
  const hole = course[state.holeIndex];
  const playerIndex = match.player1?._id === activeUserId ? 0 : 1;
  const score = state.scores?.[state.holeIndex]?.[playerIndex] ?? null;
  const canShoot = Boolean(hole && Array.isArray(state.balls) && match.status === 'ACTIVE' && match.activePlayerId === activeUserId && score === null && !acting);

  const pointForEvent = (event) => {
    const rect = boardRef.current.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1000, (event.clientX - rect.left) * (1000 / rect.width))), y: Math.max(0, Math.min(600, (event.clientY - rect.top) * (600 / rect.height))) };
  };
  const startAim = (event) => {
    if (!canShoot) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setAim({ ...pointForEvent(event), playerIndex, pointerId: event.pointerId });
  };
  const moveAim = (event) => { if (aim?.pointerId === event.pointerId) setAim((current) => current ? { ...current, ...pointForEvent(event) } : null); };
  const finishAim = (event) => {
    if (!aim || aim.pointerId !== event.pointerId) return;
    const pointer = pointForEvent(event);
    const ball = state.balls[playerIndex];
    const dx = ball.x - pointer.x;
    const dy = ball.y - pointer.y;
    const distance = Math.hypot(dx, dy);
    setAim(null);
    if (distance < 14) return;
    onShot({ angle: Math.atan2(dy, dx), power: Math.min(1, distance / 170) });
  };

  if (!hole || !Array.isArray(state.balls)) return <p className='game-result'>This Mini Golf match uses retired rules. Start a new match to play the updated course game.</p>;
  const scores = state.scores.map((item) => `${item[0] ?? '-'} / ${item[1] ?? '-'}`);
  const feedback = state.lastShot?.water ? 'Water hazard: ball returned to the tee.' : state.lastShot?.pickedUp ? 'Stroke limit reached: hole recorded as 8.' : state.lastShot?.sunk ? 'Nice putt - ball in the cup!' : canShoot ? 'Drag back from your ball and release to putt.' : 'Wait for your turn to take a shot.';

  return <div className='mini-golf-course'>
    <div className='mini-golf-map-name'>{match.gameConfig?.mapName || 'Course'}</div>
    <div className='mini-golf-meta'><b>{hole.name} - Hole {state.holeIndex + 1} of {match.gameConfig?.holes || 3}</b><span>Par {hole.par}</span></div>
    <div className={`mini-golf-board-wrap mini-golf-theme-${match.gameConfig?.theme || 'garden'}`}><div ref={boardRef}><SvgCourse hole={hole} balls={state.balls} aim={aim} canShoot={canShoot} onAimStart={startAim} onAimMove={moveAim} onAimEnd={finishAim} /></div></div>
    <div className='mini-golf-stats'><div><b>{playerName(match.player1)}</b><span>{state.strokes[0]} strokes {score === null && playerIndex === 0 ? '- putting' : ''}</span></div><div><b>{playerName(match.player2)}</b><span>{state.strokes[1]} strokes {score === null && playerIndex === 1 ? '- putting' : ''}</span></div></div>
    <p className='mini-golf-score'>Hole scores: {scores.length ? scores.join(' - ') : 'No completed holes yet'}</p>
    <p className='mini-golf-help'>{feedback}</p>
  </div>;
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

  const status = !match ? '' : match.status === 'ACTIVE' ? (match.activePlayerId === activeUserId ? 'Your turn' : `${playerName(match.activePlayerId === match.player1?._id ? match.player1 : match.player2)}'s turn`) : match.status === 'COMPLETED' ? `${playerName(match.winnerId === match.player1?._id ? match.player1 : match.player2)} won` : match.status === 'DRAW' ? 'Draw' : match.status === 'INVITED' ? 'Invitation waiting' : 'Match closed';
  // The server calculates this from the authenticated session. Do not infer it
  // from client-side ids: a stale profile can otherwise expose invitation
  // controls to the match creator.
  const isInvitee = match?.viewerRole === 'INVITEE';
  const isMiniGolf = match?.gameType === 'mini-golf';

  return <div className='game-screen-backdrop' role='presentation'><section className={`game-screen ${isMiniGolf ? 'mini-golf-screen' : ''}`} role='dialog' aria-modal='true' aria-label={`${gameName(match?.gameType)} match`}>
    <header><div><span className='game-eyebrow'>GAMES</span><h2>{gameName(match?.gameType)}</h2><p>{status}</p></div><button type='button' onClick={onClose} aria-label='Return to chat'>x</button></header>
    {loading ? <div className='game-loading'>Loading match...</div> : match && <><div className='game-players'><span className={match.activePlayerId === match.player1?._id ? 'game-player-active' : ''}>{playerName(match.player1)} <b>{isMiniGolf ? '1' : 'X'}</b></span><span className={match.activePlayerId === match.player2?._id ? 'game-player-active' : ''}>{playerName(match.player2)} <b>{isMiniGolf ? '2' : 'O'}</b></span></div>
      {match.status === 'INVITED' && isInvitee && <div className='game-invite-actions'><button type='button' disabled={acting} onClick={() => answerInvite(true)}>Accept</button><button type='button' disabled={acting} onClick={() => answerInvite(false)}>Decline</button></div>}
      {match.status === 'INVITED' && !isInvitee && <p className='game-waiting'>Waiting for {playerName(match.player2)} to accept.</p>}
      {match.status !== 'INVITED' && (isMiniGolf ? <MiniGolfCourse match={match} activeUserId={activeUserId} acting={acting} onShot={(shot) => submitAction('SHOT', shot)} /> : <div className='tic-tac-toe-board' aria-label='Tic-Tac-Toe board'>{match.authoritativeState.board.map((mark, cell) => <button key={cell} type='button' disabled={acting || match.status !== 'ACTIVE' || match.activePlayerId !== activeUserId || Boolean(mark)} onClick={() => submitAction('MOVE', { cell })} aria-label={`Square ${cell + 1}`} className={mark === 1 ? 'mark-x' : mark === 2 ? 'mark-o' : ''}>{mark === 1 ? 'X' : mark === 2 ? 'O' : ''}</button>)}</div>)}
      {match.status === 'ACTIVE' && <button type='button' className='game-forfeit' onClick={forfeit} disabled={acting}>Forfeit match</button>}
      {match.status !== 'ACTIVE' && match.status !== 'INVITED' && <p className='game-result'>This result is saved in your conversation.</p>}</>}
  </section></div>;
}
