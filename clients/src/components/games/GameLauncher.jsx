import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { createGameMatch } from '../../apis/games';
import { singlePlayerGames, SinglePlayerGameScreen } from './SinglePlayerGames';
import { useGameFavorites } from './gameFavorites';

const multiplayerGames = [
  { id: 'tic-tac-toe', name: 'Tic-Tac-Toe', detail: 'Play now', icon: 'X O', available: true },
  { id: 'mini-golf', name: 'Mini Golf', detail: 'Play the five classic levels', icon: 'GOLF', available: true },
  { id: 'knockout', name: 'Knockout', detail: 'Slide seals across the ice', icon: 'KO', available: true },
  { id: 'crazy-8-ball', name: 'Crazy 8 Ball', detail: 'Server-checked cue shots', icon: '8B', available: true },
  { id: 'word-hunt', name: 'Word Hunt', detail: 'Find connected words', icon: 'WORD', available: true },
  { id: 'filler', name: 'Filler', detail: 'Claim the colour board', icon: 'FILL', available: true },
];

const miniGolfMaps = [
  { id: 'classic-2d-mini-golf', name: '2D Mini Golf', detail: 'Five original levels with moving obstacles' },
];

export default function GameLauncher({ chatId, onMatchCreated }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [choosingMap, setChoosingMap] = useState(false);
  const [tab, setTab] = useState('multiplayer');
  const [singlePlayerGame, setSinglePlayerGame] = useState(null);
  const [archiveGames, setArchiveGames] = useState([]);
  const [gameSearch, setGameSearch] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { favoriteIds, isFavorite, toggleFavorite } = useGameFavorites();

  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL || ''}/single-player-games/index.json`)
      .then((response) => response.ok ? response.json() : [])
      .then((games) => setArchiveGames(Array.isArray(games) ? games : []))
      .catch(() => setArchiveGames([]));
  }, []);

  const allSinglePlayerGames = useMemo(() => {
    const seenSources = new Set(singlePlayerGames.map((game) => game.source));
    const seenNames = new Set(singlePlayerGames.map((game) => game.name.toLowerCase()));
    return [...singlePlayerGames, ...archiveGames.filter((game) => !seenSources.has(game.source) && !seenNames.has(game.name.toLowerCase()))];
  }, [archiveGames]);
  const displayedSinglePlayerGames = useMemo(() => {
    const query = gameSearch.trim().toLowerCase();
    return allSinglePlayerGames
      .filter((game) => !query || game.name.toLowerCase().includes(query))
      .filter((game) => !favoritesOnly || favoriteIds.has(game.id))
      .sort((left, right) => Number(favoriteIds.has(right.id)) - Number(favoriteIds.has(left.id)) || left.name.localeCompare(right.name))
      .slice(0, query ? 80 : 48);
  }, [allSinglePlayerGames, favoriteIds, favoritesOnly, gameSearch]);

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
      <div className='game-catalog-tabs' role='tablist' aria-label='Game type'>
        <button type='button' role='tab' aria-selected={tab === 'multiplayer'} className={tab === 'multiplayer' ? 'game-catalog-tab-active' : ''} onClick={() => setTab('multiplayer')}>Multiplayer</button>
        <button type='button' role='tab' aria-selected={tab === 'single-player'} className={tab === 'single-player' ? 'game-catalog-tab-active' : ''} onClick={() => setTab('single-player')}>Single player</button>
      </div>
      {tab === 'multiplayer' && multiplayerGames.map((game) => game.id === 'mini-golf' ? <div key={game.id} className='game-catalog-mini-golf'>
        <button type='button' className='game-catalog-card' disabled={creating} onClick={() => setChoosingMap((value) => !value)}>
          <span className='game-catalog-icon'>{game.icon}</span><span><b>{game.name}</b><small>{game.detail}</small></span><em>{choosingMap ? 'Hide courses' : 'Choose course'}</em>
        </button>
        {choosingMap && <div className='mini-golf-map-options' aria-label='Choose a Mini Golf course'>
          {miniGolfMaps.map((map) => <button key={map.id} type='button' disabled={creating} onClick={() => start('mini-golf', map.id)}><b>{map.name}</b><small>5 levels - {map.detail}</small></button>)}
        </div>}
      </div> : <button key={game.id} type='button' className='game-catalog-card' disabled={!game.available || creating} onClick={() => start(game.id)}>
        <span className='game-catalog-icon'>{game.icon}</span><span><b>{game.name}</b><small>{game.detail}</small></span>{!game.available && <em>Coming soon</em>}
      </button>)}
      {tab === 'single-player' && <div className='single-player-catalog' role='tabpanel'>
        <p className='single-player-catalog-intro'>Choose a game to play on your own.</p>
        <input className='single-player-search' value={gameSearch} onChange={(event) => setGameSearch(event.target.value)} type='search' placeholder='Search games' aria-label='Search single-player games' />
        <button type='button' className={favoritesOnly ? 'single-player-favorites-toggle single-player-favorites-toggle-active' : 'single-player-favorites-toggle'} onClick={() => setFavoritesOnly((value) => !value)} aria-pressed={favoritesOnly}>{favoritesOnly ? 'Showing favourites' : `Favourites (${favoriteIds.size})`}</button>
        <div className='single-player-grid'>{displayedSinglePlayerGames.map((game) => <div key={game.id} className='single-player-card-wrap'>
          <button type='button' className={`single-player-card single-player-${game.palette}`} onClick={() => { setOpen(false); setSinglePlayerGame(game); }}><span>{game.icon}</span><b>{game.name}</b><small>{game.detail}</small></button>
          <button type='button' className={isFavorite(game.id) ? 'single-player-favorite single-player-favorite-active' : 'single-player-favorite'} onClick={() => toggleFavorite(game.id)} aria-label={`${isFavorite(game.id) ? 'Remove' : 'Add'} ${game.name} ${isFavorite(game.id) ? 'from' : 'to'} favourites`} aria-pressed={isFavorite(game.id)}>{isFavorite(game.id) ? '★' : '☆'}</button>
        </div>)}</div>
      </div>}
    </div>}
    {singlePlayerGame && <SinglePlayerGameScreen game={singlePlayerGame} onClose={() => setSinglePlayerGame(null)} />}
  </div>;
}
