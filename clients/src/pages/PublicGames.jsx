import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { singlePlayerGames, SinglePlayerGameScreen } from '../components/games/SinglePlayerGames';
import './PublicGames.css';

export default function PublicGames() {
  const [activeGame, setActiveGame] = useState(null);
  const [archiveGames, setArchiveGames] = useState([]);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(48);

  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL || ''}/single-player-games/index.json`)
      .then((response) => response.ok ? response.json() : [])
      .then((games) => setArchiveGames(Array.isArray(games) ? games : []))
      .catch(() => setArchiveGames([]));
  }, []);

  const games = useMemo(() => {
    const seenSources = new Set(singlePlayerGames.map((game) => game.source));
    const seenNames = new Set(singlePlayerGames.map((game) => game.name.toLowerCase()));
    return [...singlePlayerGames, ...archiveGames.filter((game) => !seenSources.has(game.source) && !seenNames.has(game.name.toLowerCase()))];
  }, [archiveGames]);
  const filteredGames = useMemo(() => {
    const term = query.trim().toLowerCase();
    return games
      .filter((game) => !term || `${game.name} ${game.detail}`.toLowerCase().includes(term));
  }, [games, query]);
  const visibleGames = filteredGames.slice(0, visibleCount);

  const updateQuery = (event) => {
    setQuery(event.target.value);
    setVisibleCount(48);
  };

  return <main className='public-games-page'>
    <header className='public-games-header'>
      <Link to='/' className='public-games-brand'>MESSAGES</Link>
      <nav><Link to='/login'>Sign in to chat</Link><Link to='/register' className='public-games-join'>Create account</Link></nav>
    </header>
    <section className='public-games-hero'>
      <p>Play instantly</p>
      <h1>Single-player games</h1>
      <span>No account needed. Pick a game and start playing.</span>
    </section>
    <div className='public-games-tools'>
      <label><span className='sr-only'>Search games</span><input value={query} onChange={updateQuery} type='search' placeholder='Search the game library' /></label>
      <div className='public-games-filter'><Link to='/register'>Create an account to favourite games</Link><p>{filteredGames.length} games ready to play</p></div>
    </div>
    <section className='public-games-grid' aria-label='Single-player games'>
      {visibleGames.map((game, index) => <article key={game.id} className={`public-games-card single-player-${game.palette}`} style={{ '--game-rotation': `${(index % 5) - 2}deg` }}>
        <button type='button' className='public-games-play' onClick={() => setActiveGame(game)}>
          <span className='public-games-card-art'><i>{game.icon}</i><u>{String(index + 1).padStart(2, '0')}</u></span><b>{game.name}</b><small>{game.detail}</small><em>Play now &rarr;</em>
        </button>
        <Link to='/register' className='public-games-favorite' aria-label={`Create an account to favourite ${game.name}`}>☆</Link>
      </article>)}
    </section>
    {visibleGames.length < filteredGames.length && <button type='button' className='public-games-more' onClick={() => setVisibleCount((count) => count + 48)}>Show more games</button>}
    {activeGame && <SinglePlayerGameScreen game={activeGame} onClose={() => setActiveGame(null)} />}
  </main>;
}
