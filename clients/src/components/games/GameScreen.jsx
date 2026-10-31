import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { acceptGameMatch, declineGameMatch, fetchGameMatch, forfeitGameMatch, submitGameAction } from '../../apis/games';

function playerName(player) {
  return player?.name || 'Player';
}

function gameName(gameType) {
  return gameType === 'mini-golf' ? 'Mini Golf' : 'Tic-Tac-Toe';
}

function MiniGolfCourse({ match, activeUserId, acting, onShot }) {
  const state = match.authoritativeState;
  const hole = state.holeIndex + 1;
  const course = match.gameConfig?.course || [];
  const currentHole = course[state.holeIndex] || { par: 3, wind: 0 };
  const holeCount = match.gameConfig?.holes || 3;
  const mapId = match.gameConfig?.mapId || state.mapId || 'sunset-links';
  const myIndex = match.player1?._id === activeUserId ? 0 : 1;
  const canShoot = match.status === 'ACTIVE' && match.activePlayerId === activeUserId && (state.scores[state.holeIndex]?.[myIndex] ?? null) === null;
  const scores = state.scores.map((score) => `${score[0] ?? '-'} / ${score[1] ?? '-'}`);

  return <div className='mini-golf-course'>
    <div className='mini-golf-map-name'>{match.gameConfig?.mapName || 'Sunset Links'}</div>
    <div className='mini-golf-meta'><b>Hole {hole} of {holeCount}</b><span>Par {currentHole.par} - Wind {currentHole.wind > 0 ? '+' : ''}{currentHole.wind}</span></div>
    <div className={`mini-golf-fairway mini-golf-map-${mapId}`} aria-label={`Mini Golf hole ${hole}`}>
      <span className='mini-golf-flag'>GOLF</span>
      <span className='mini-golf-ball mini-golf-ball-one' style={{ left: `${Math.max(5, 92 - state.distances[0])}%` }} />
      <span className='mini-golf-ball mini-golf-ball-two' style={{ left: `${Math.max(5, 92 - state.distances[1])}%` }} />
    </div>
    <div className='mini-golf-stats'><div><b>{playerName(match.player1)}</b><span>{state.distances[0]}m left - {state.strokes[0]} strokes</span></div><div><b>{playerName(match.player2)}</b><span>{state.distances[1]}m left - {state.strokes[1]} strokes</span></div></div>
    <p className='mini-golf-score'>Hole scores: {scores.length ? scores.join(' - ') : 'No completed holes yet'}</p>
    <div className='mini-golf-powers'>{[1, 2, 3, 4, 5].map((power) => <button key={power} type='button' disabled={!canShoot || acting} onClick={() => onShot(power)}>Power {power}</button>)}</div>
    <p className='mini-golf-help'>{canShoot ? 'Choose your shot power. Lowest total strokes after three holes wins.' : 'Wait for your turn to take a shot.'}</p>
  </div>;
}

export default function GameScreen({ matchId, initialMatch = null, activeUserId, onClose }) {
  const hasInitialMatch = initialMatch?.id === matchId;
  const [match, setMatch] = useState(() => hasInitialMatch ? initialMatch : null);
  const [loading, setLoading] = useState(() => !hasInitialMatch);
  const [acting, setActing] = useState(false);

  const refresh = useCallback(async (quiet = false) => {
    try { setMatch(await fetchGameMatch(matchId)); }
    catch (error) { if (!quiet) toast.error(error.response?.data?.message || 'Unable to load this match.'); }
    finally { setLoading(false); }
  }, [matchId]);

  useEffect(() => {
    if (!hasInitialMatch) refresh();
    const timer = window.setInterval(() => refresh(true), 30_000);
    return () => window.clearInterval(timer);
  }, [hasInitialMatch, refresh]);

  const answerInvite = async (accept) => {
    setActing(true);
    try { setMatch(await (accept ? acceptGameMatch(matchId) : declineGameMatch(matchId))); }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update the invitation.'); }
    finally { setActing(false); }
  };

  const submitAction = async (actionType, actionPayload) => {
    if (!match || acting || match.activePlayerId !== activeUserId) return;
    setActing(true);
    try { setMatch(await submitGameAction(match, actionType, actionPayload)); }
    catch (error) { toast.error(error.response?.data?.message || 'That action was not accepted.'); await refresh(true); }
    finally { setActing(false); }
  };

  const forfeit = async () => {
    if (!window.confirm('Forfeit this match?')) return;
    setActing(true);
    try { setMatch(await forfeitGameMatch(matchId)); }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to forfeit the match.'); }
    finally { setActing(false); }
  };

  const status = !match ? '' : match.status === 'ACTIVE'
    ? (match.activePlayerId === activeUserId ? 'Your turn' : `${playerName(match.activePlayerId === match.player1?._id ? match.player1 : match.player2)}'s turn`)
    : match.status === 'COMPLETED' ? `${playerName(match.winnerId === match.player1?._id ? match.player1 : match.player2)} won`
    : match.status === 'DRAW' ? 'Draw' : match.status === 'INVITED' ? 'Invitation waiting' : 'Match closed';
  const isInvitee = match?.viewerRole === 'INVITEE' || match?.player2?._id === activeUserId;
  const isMiniGolf = match?.gameType === 'mini-golf';

  return <div className='game-screen-backdrop' role='presentation'>
    <section className='game-screen' role='dialog' aria-modal='true' aria-label={`${gameName(match?.gameType)} match`}>
      <header><div><span className='game-eyebrow'>GAMES</span><h2>{gameName(match?.gameType)}</h2><p>{status}</p></div><button type='button' onClick={onClose} aria-label='Return to chat'>x</button></header>
      {loading ? <div className='game-loading'>Loading match...</div> : match && <>
        <div className='game-players'><span className={match.activePlayerId === match.player1?._id ? 'game-player-active' : ''}>{playerName(match.player1)} <b>{isMiniGolf ? 'G' : 'X'}</b></span><span className={match.activePlayerId === match.player2?._id ? 'game-player-active' : ''}>{playerName(match.player2)} <b>{isMiniGolf ? 'G' : 'O'}</b></span></div>
        {match.status === 'INVITED' && isInvitee && <div className='game-invite-actions'><button type='button' disabled={acting} onClick={() => answerInvite(true)}>Accept</button><button type='button' disabled={acting} onClick={() => answerInvite(false)}>Decline</button></div>}
        {match.status === 'INVITED' && !isInvitee && <p className='game-waiting'>Waiting for {playerName(match.player2)} to accept.</p>}
        {isMiniGolf ? <MiniGolfCourse match={match} activeUserId={activeUserId} acting={acting} onShot={(power) => submitAction('SHOT', { power })} /> : <div className='tic-tac-toe-board' aria-label='Tic-Tac-Toe board'>{match.authoritativeState.board.map((mark, cell) => <button key={cell} type='button' disabled={acting || match.status !== 'ACTIVE' || match.activePlayerId !== activeUserId || Boolean(mark)} onClick={() => submitAction('MOVE', { cell })} aria-label={`Square ${cell + 1}`} className={mark === 1 ? 'mark-x' : mark === 2 ? 'mark-o' : ''}>{mark === 1 ? 'X' : mark === 2 ? 'O' : ''}</button>)}</div>}
        {match.status === 'ACTIVE' && <button type='button' className='game-forfeit' onClick={forfeit} disabled={acting}>Forfeit match</button>}
        {match.status !== 'ACTIVE' && match.status !== 'INVITED' && <p className='game-result'>This result is saved in your conversation.</p>}
      </>}
    </section>
  </div>;
}
