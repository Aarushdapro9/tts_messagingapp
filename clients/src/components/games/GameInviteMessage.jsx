const friendlyStatus = {
  INVITED: 'Invitation waiting',
  ACTIVE: 'Match in progress',
  COMPLETED: 'Match complete',
  DRAW: 'Draw',
  FORFEITED: 'Match forfeited',
  CANCELLED: 'Invitation declined',
};

export default function GameInviteMessage({ message, onOpen }) {
  const name = message.gameType === 'tic-tac-toe' ? 'Tic-Tac-Toe' : message.gameType === 'mini-golf' ? 'Mini Golf' : 'Game';
  return <button type='button' className='game-invite-message' onClick={() => onOpen(message)}>
    <span className='game-invite-symbol'>{message.gameType === 'mini-golf' ? '⛳' : 'X O'}</span>
    <span><b>{name}</b><small>{friendlyStatus[message.gameStatus] || 'Open match'}</small></span>
    <span className='game-invite-open'>Open</span>
  </button>;
}
