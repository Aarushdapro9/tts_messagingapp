import { useState } from 'react';
import { toast } from 'react-toastify';
import { createGameMatch } from '../../apis/games';

const games = [
  { id: 'tic-tac-toe', name: 'Tic-Tac-Toe', detail: 'Play now', icon: 'X O', available: true },
  { id: 'mini-golf', name: 'Mini Golf', detail: 'Pick a three-hole course', icon: 'GOLF', available: true },
  { id: '8-ball-pool', name: '8-Ball Pool', detail: 'Physics in development', icon: '8B', available: false },
];

const miniGolfMaps = [
  { id: 'sunset-links', name: 'Sunset Links', detail: 'Balanced fairways' },
  { id: 'neon-night', name: 'Neon Night', detail: 'Fast with shifting wind' },
  { id: 'forest-run', name: 'Forest Run', detail: 'Long woodland shots' },
];

export default function GameLauncher({ chatId, onMatchCreated }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [choosingMap, setChoosingMap] = useState(false);

  const start = async (gameType, mapId) => {
    setCreating(true);
    try {
      const { match } = await createGameMatch(chatId, gameType, mapId);
      setOpen(false);
      setChoosingMap(false);
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
      <div className='game-catalog-header'><b>Games</b><button type='button' onClick={() => setOpen(false)} aria-label='Close games'>x</button></div>
      {games.map((game) => game.id === 'mini-golf' ? <div key={game.id} className='game-catalog-mini-golf'>
        <button type='button' className='game-catalog-card' disabled={creating} onClick={() => setChoosingMap((value) => !value)}>
          <span className='game-catalog-icon'>{game.icon}</span><span><b>{game.name}</b><small>{game.detail}</small></span><em>{choosingMap ? 'Hide courses' : 'Choose course'}</em>
        </button>
        {choosingMap && <div className='mini-golf-map-options' aria-label='Choose a Mini Golf course'>
          {miniGolfMaps.map((map) => <button key={map.id} type='button' disabled={creating} onClick={() => start('mini-golf', map.id)}><b>{map.name}</b><small>3 holes - {map.detail}</small></button>)}
        </div>}
      </div> : <button key={game.id} type='button' className='game-catalog-card' disabled={!game.available || creating} onClick={() => start(game.id)}>
        <span className='game-catalog-icon'>{game.icon}</span><span><b>{game.name}</b><small>{game.detail}</small></span>{!game.available && <em>Coming soon</em>}
      </button>)}
    </div>}
  </div>;
}
