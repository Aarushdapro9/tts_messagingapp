import { useRef } from 'react';

export const singlePlayerGames = [
  { id: '10-bullets', name: '10 Bullets', detail: 'Chain together every shot', source: '10-bullets.html', icon: '10X', palette: 'rose' },
  { id: '10-minutes-till-dawn', name: '10 Minutes Till Dawn', detail: 'Survive the night against endless enemies', source: 'cl10minutestildawn.html', icon: '10M', palette: 'violet' },
  { id: 'crazy-motorcycle', name: 'Crazy Motorcycle', detail: 'Race across tricky tracks', source: 'clcrazymotorcycle.html', icon: 'MOTO', palette: 'coral' },
  { id: 'geometry-vibes', name: 'Geometry Vibes', detail: 'Keep pace through neon obstacles', source: 'clgeometryvibes.html', icon: 'GEO', palette: 'sky' },
  { id: 'leap-and-avoid-2', name: 'Leap and Avoid 2', detail: 'Time every jump perfectly', source: 'clleapandavoid2.html', icon: 'LEAP', palette: 'mint' },
  { id: 'moto-x3m-2', name: 'Moto X3M 2', detail: 'Motorbike stunt challenges', source: 'clmotox3m2.html', icon: 'X3M', palette: 'rose' },
  { id: 'mr-racer', name: 'MR Racer', detail: 'Drive through high-speed traffic', source: 'clmrracer.html', icon: 'RACE', palette: 'coral' },
  { id: 'rooftop-run', name: 'Rooftop Run', detail: 'Parkour across city rooftops', source: 'clrooftoprun.html', icon: 'RUN', palette: 'sky' },
  { id: 'ragdoll-runner', name: 'Ragdoll Runner', detail: 'Race through chaotic courses', source: 'clragdollrunners.html', icon: 'RAG', palette: 'violet' },
  { id: 'gym-stack', name: 'Gym Stack', detail: 'Build your training stack', source: 'clgymstack.html', icon: 'GYM', palette: 'mint' },
  { id: 'ultimate-evolution', name: 'Ultimate Evolution', detail: 'Evolve your way forward', source: 'clevolution.html', icon: 'EVO', palette: 'lime' },
  { id: 'snake-like', name: 'Snake Like', detail: 'Grow, turn and stay alive', source: 'clsnakelike.html', icon: 'SNAKE', palette: 'lime' },
  { id: 'angry-birds', name: 'Angry Birds', detail: 'Launch birds and topple towers', source: 'clangrybirds.html', icon: 'BIRDS', palette: 'coral' },
  { id: 'friday-night-funkin', name: "Friday Night Funkin'", detail: 'Hit every beat', source: 'clfridaynightfunkin.html', icon: 'FNF', palette: 'violet' },
  { id: 'pokemon-emerald', name: 'Pokemon Emerald', detail: 'A Game Boy Advance adventure', source: 'clpokemonemerald.html', icon: 'GBA', palette: 'coral' },
  { id: 'wordle', name: 'Wordle', detail: 'Guess the hidden word', source: 'clwordle.html', icon: 'WORD', palette: 'lime' },
  { id: 'vex-7', name: 'Vex 7', detail: 'Precision platform challenge', source: 'clvex7.html', icon: 'V7', palette: 'violet' },
  { id: 'vex-4', name: 'Vex 4', detail: 'Classic Vex levels', source: 'clvex4.html', icon: 'V4', palette: 'gold' },
  { id: 'vex-3', name: 'Vex 3', detail: 'The original obstacle run', source: 'clvex3.html', icon: 'V3', palette: 'mint' },
  { id: 'townscaper', name: 'Townscaper', detail: 'Make a colourful town', source: 'cltownscraper.html', icon: 'TOWN', palette: 'sky' },
  { id: 'sort-the-court', name: 'Sort the Court!', detail: 'Rule your growing kingdom', source: 'clsortthecourt.html', icon: 'CROWN', palette: 'gold' },
  { id: 'temple-run-2', name: 'Temple Run 2', detail: 'Escape the temple', source: 'cltemplerun2.html', icon: 'RUN', palette: 'gold' },
  { id: 'super-onion-boy-2', name: 'Super Onion Boy 2', detail: 'Retro platform adventure', source: 'clsuperonionboy2.html', icon: 'ONION', palette: 'mint' },
  { id: 'spelunky', name: 'Spelunky', detail: 'Explore dangerous caves', source: 'clspelunky.html', icon: 'CAVE', palette: 'gold' },
  { id: 'sonic-falling-star', name: 'Sonic: Falling Star', detail: 'High-speed platforming', source: 'clsonicandfallingstar.html', icon: 'SONIC', palette: 'sky' },
  { id: 'mario-64-webgl', name: 'Mario 64', detail: 'A 3D platform classic', source: 'clmario64webgl.html', icon: '64', palette: 'coral' },
];

export function SinglePlayerGameScreen({ game, onClose }) {
  const frameRef = useRef(null);
  const openFullscreen = () => frameRef.current?.requestFullscreen?.().catch(() => {});

  return <div className='single-player-backdrop' role='dialog' aria-modal='true' aria-label={`Playing ${game.name}`}>
    <section className='single-player-screen'>
      <header className='single-player-screen-header'>
        <div><span>Single player</span><h2>{game.name}</h2><p>{game.detail}</p></div>
        <div className='single-player-screen-actions'><button type='button' onClick={openFullscreen}>Fullscreen</button><button type='button' onClick={onClose} aria-label='Close game'>×</button></div>
      </header>
      <iframe ref={frameRef} className='single-player-frame' src={`${process.env.PUBLIC_URL || ''}/single-player-games/${game.source}`} title={game.name} sandbox='allow-forms allow-modals allow-pointer-lock allow-popups allow-scripts' allow='fullscreen; gamepad; autoplay' />
      <p className='single-player-help'>If a game needs a moment to load, use its own on-screen start button.</p>
    </section>
  </div>;
}
