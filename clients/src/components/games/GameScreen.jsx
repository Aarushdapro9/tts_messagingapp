import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  acceptGameMatch,
  declineGameMatch,
  fetchGameMatch,
  forfeitGameMatch,
  submitGameAction,
} from '../../apis/games';

function playerName(player) {
  return player?.name || 'Player';
}

export default function GameScreen({ matchId, activeUserId, onClose }) {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const refresh = useCallback(async (quiet = false) => {
    try {
      setMatch(await fetchGameMatch(matchId));
    } catch (error) {
      if (!quiet) toast.error(error.response?.data?.message || 'Unable to load this match.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => refresh(true), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const answerInvite = async (accept) => {
    setActing(true);
    try {
      setMatch(await (accept ? acceptGameMatch(matchId) : declineGameMatch(matchId)));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update the invitation.');
    } finally { setActing(false); }
  };

  const move = async (cell) => {
    if (!match || acting || match.activePlayerId !== activeUserId || match.authoritativeState.board[cell]) return;
    setActing(true);
    try {
      setMatch(await submitGameAction(match, cell));
    } catch (error) {
      toast.error(error.response?.data?.message || 'That move was not accepted.');
      await refresh(true);
    } finally { setActing(false); }
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

  return <div className='game-screen-backdrop' role='presentation'>
    <section className='game-screen' role='dialog' aria-modal='true' aria-label='Tic-Tac-Toe match'>
      <header><div><span className='game-eyebrow'>GAMES</span><h2>Tic-Tac-Toe</h2><p>{status}</p></div><button type='button' onClick={onClose} aria-label='Return to chat'>×</button></header>
      {loading ? <div className='game-loading'>Loading match…</div> : match && <>
        <div className='game-players'><span className={match.activePlayerId === match.player1?._id ? 'game-player-active' : ''}>{playerName(match.player1)} <b>×</b></span><span className={match.activePlayerId === match.player2?._id ? 'game-player-active' : ''}>{playerName(match.player2)} <b>○</b></span></div>
        {match.status === 'INVITED' && match.player2?._id === activeUserId && <div className='game-invite-actions'><button type='button' disabled={acting} onClick={() => answerInvite(true)}>Accept</button><button type='button' disabled={acting} onClick={() => answerInvite(false)}>Decline</button></div>}
        {match.status === 'INVITED' && match.player1?._id === activeUserId && <p className='game-waiting'>Waiting for {playerName(match.player2)} to accept.</p>}
        <div className='tic-tac-toe-board' aria-label='Tic-Tac-Toe board'>
          {match.authoritativeState.board.map((mark, cell) => <button key={cell} type='button' disabled={acting || match.status !== 'ACTIVE' || match.activePlayerId !== activeUserId || Boolean(mark)} onClick={() => move(cell)} aria-label={`Square ${cell + 1}`} className={mark === 1 ? 'mark-x' : mark === 2 ? 'mark-o' : ''}>{mark === 1 ? '×' : mark === 2 ? '○' : ''}</button>)}
        </div>
        {match.status === 'ACTIVE' && <button type='button' className='game-forfeit' onClick={forfeit} disabled={acting}>Forfeit match</button>}
        {match.status !== 'ACTIVE' && match.status !== 'INVITED' && <p className='game-result'>This result is saved in your conversation.</p>}
      </>}
    </section>
  </div>;
}
