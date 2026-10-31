import { useState } from 'react';
import { toast } from 'react-toastify';
import { createGameMatch } from '../../apis/games';

const games = [
  { id: 'tic-tac-toe', name: 'Tic-Tac-Toe', detail: 'Play now', icon: 'X O', available: true },
  { id: 'mini-golf', name: 'Mini Golf', detail: 'Physics in development', icon: '⛳', available: false },
  { id: '8-ball-pool', name: '8-Ball Pool', detail: 'Physics in development', icon: '🎱', available: false },
];

export default function GameLauncher({ chatId, onMatchCreated }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const start = async (gameType) => {
    setCreating(true);
    try {
      const { match } = await createGameMatch(chatId, gameType);
      setOpen(false);
      // The creation response is an authoritative snapshot, so opening it does not
      // need a second immediate request while a serverless write settles.
      onMatchCreated(match);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create this match.');
    } finally {
      setCreating(false);
    }
  };

  return <div className='relative'>
    <button type='button' onClick={() => setOpen((value) => !value)} className='game-launcher-button' aria-expanded={open}>Games</button>
    {open && <div className='game-catalog' role='dialog' aria-label='Choose a game'>
      <div className='game-catalog-header'><b>Games</b><button type='button' onClick={() => setOpen(false)} aria-label='Close games'>×</button></div>
      {games.map((game) => <button key={game.id} type='button' className='game-catalog-card' disabled={!game.available || creating} onClick={() => start(game.id)}>
        <span className='game-catalog-icon'>{game.icon}</span><span><b>{game.name}</b><small>{game.detail}</small></span>{!game.available && <em>Coming soon</em>}
      </button>)}
    </div>}
  </div>;
}
