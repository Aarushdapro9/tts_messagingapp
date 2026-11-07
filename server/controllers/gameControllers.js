import {
  createId,
  expandMessage,
  findUser,
  getDatabase,
  noDatabaseWrite,
  updateDatabase,
  withoutPassword,
} from '../storage/store.js';
import {
  TIC_TAC_TOE_RULESET_VERSION,
  applyTicTacToeMove,
  createTicTacToeState,
} from '../games/ticTacToe.js';
import {
  MINI_GOLF_RULESET_VERSION,
  applyMiniGolfShot,
  createMiniGolfState,
  getMiniGolfMap,
} from '../games/miniGolf.js';
import {
  ARCADE_RULESET_VERSION,
  applyEightBallShot,
  applyFillerMove,
  applyKnockoutPush,
  applyWordHuntWord,
  createEightBallState,
  createFillerState,
  createKnockoutState,
  createWordHuntState,
} from '../games/arcadeGames.js';
import { expireGameInvitation, gameInvitationExpiresAt, hasGameInvitationExpired } from '../games/invitationExpiry.js';
import { hasActiveRestriction } from '../services/moderation.js';

const SCHEMA_VERSION = 1;
const MATCH_STATUSES = new Set(['CREATED', 'INVITED', 'ACTIVE', 'COMPLETED', 'DRAW', 'FORFEITED', 'EXPIRED', 'CANCELLED']);

function error(code, message, status = 400) {
  return { error: true, code, message, status };
}

function gameDefinition(gameType, mapId) {
  if (gameType === 'tic-tac-toe') return {
    rulesetVersion: TIC_TAC_TOE_RULESET_VERSION,
    gameConfig: { boardSize: 3 },
    createState: createTicTacToeState,
    inviteText: 'Tic-Tac-Toe invitation',
  };
  if (gameType === 'mini-golf') {
    const map = getMiniGolfMap(mapId);
    if (!map) return null;
    return {
      rulesetVersion: MINI_GOLF_RULESET_VERSION,
      gameConfig: { mapId: map.id, mapName: map.name, theme: map.theme, holes: map.holes.length, course: map.holes, scoring: 'lowest-strokes' },
      createState: () => createMiniGolfState(map.id),
      inviteText: `Mini Golf: ${map.name}`,
    };
  }
  const arcadeGames = {
    knockout: { name: 'Knockout', state: createKnockoutState, text: 'Knockout invitation', description: 'Slide your seals and knock the other team out.' },
    'crazy-8-ball': { name: 'Crazy 8 Ball', state: createEightBallState, text: 'Crazy 8 Ball invitation', description: 'Pocket balls with a server-checked cue shot.' },
    'word-hunt': { name: 'Word Hunt', state: createWordHuntState, text: 'Word Hunt invitation', description: 'Find connected words on the shared board.' },
    filler: { name: 'Filler', state: createFillerState, text: 'Filler invitation', description: 'Claim the board by expanding your colour.' },
  };
  const arcade = arcadeGames[gameType];
  if (arcade) return {
    rulesetVersion: ARCADE_RULESET_VERSION,
    gameConfig: { name: arcade.name, description: arcade.description },
    createState: arcade.state,
    inviteText: arcade.text,
  };
  return null;
}

function canAccessMatch(match, userId) {
  return Boolean(match && (match.player1Id === userId || match.player2Id === userId));
}

function isDirectConversation(chat) {
  return Boolean(chat && !chat.isGroup && !chat.isGlobal && chat.users?.length === 2);
}

function matchResponse(database, match, viewerId = null) {
  const viewerRole = viewerId === match.player1Id ? 'CREATOR' : viewerId === match.player2Id ? 'INVITEE' : null;
  return {
    id: match.id,
    conversationId: match.conversationId,
    gameType: match.gameType,
    schemaVersion: match.schemaVersion,
    rulesetVersion: match.rulesetVersion,
    physicsVersion: match.physicsVersion,
    player1: withoutPassword(findUser(database, match.player1Id)),
    player2: withoutPassword(findUser(database, match.player2Id)),
    viewerRole,
    activePlayerId: match.activePlayerId,
    status: match.status,
    currentTurn: match.currentTurn,
    revision: match.revision,
    gameConfig: match.gameConfig,
    authoritativeState: match.authoritativeState,
    winnerId: match.winnerId,
    createdAt: match.createdAt,
    updatedAt: match.updatedAt,
    completedAt: match.completedAt,
    expiresAt: match.expiresAt,
  };
}

function updateInviteMessage(database, match) {
  const message = database.messages.find((item) => item.type === 'game_invite' && item.gameId === match.id);
  if (!message) return;
  message.gameStatus = match.status;
  message.gameTurn = match.currentTurn;
  message.gameActivePlayerId = match.activePlayerId;
  message.gameWinnerId = match.winnerId || null;
  message.updatedAt = match.updatedAt;
}

function expireInviteIfNeeded(database, match, now = Date.now()) {
  if (!expireGameInvitation(match, now)) return false;
  updateInviteMessage(database, match);
  return true;
}

function finishTimedWordHuntIfNeeded(database, match, now = Date.now()) {
  const endsAt = match?.authoritativeState?.roundEndsAt;
  if (match?.gameType !== 'word-hunt' || match.status !== 'ACTIVE' || !endsAt || new Date(endsAt).getTime() > now) return false;
  const scores = match.authoritativeState.scores || [0, 0];
  match.status = scores[0] === scores[1] ? 'DRAW' : 'COMPLETED';
  match.winnerId = scores[0] === scores[1] ? null : scores[0] > scores[1] ? match.player1Id : match.player2Id;
  match.activePlayerId = null;
  match.completedAt = new Date(now).toISOString();
  match.updatedAt = match.completedAt;
  match.revision += 1;
  updateInviteMessage(database, match);
  return true;
}

function resolveDirectConversation(database, chatId, userId) {
  const chat = database.chats.find((item) => item._id === chatId);
  if (!isDirectConversation(chat) || !chat.users.includes(userId)) return null;
  return chat;
}

function actionResult(database, match, viewerId) {
  return { match: matchResponse(database, match, viewerId) };
}

function sendResult(res, result, successStatus = 200) {
  if (result?.error) return res.status(result.status).json({ code: result.code, message: result.message });
  return res.status(successStatus).json(result);
}

export const createMatch = async (req, res) => {
  const { chatId, gameType, mapId } = req.body;
  const game = gameDefinition(gameType, mapId);
  if (!game) {
    return sendResult(res, error('INVALID_ACTION', 'That game is not available.'));
  }
  if (!chatId) return sendResult(res, error('INVALID_ACTION', 'Choose a private conversation.'));

  const result = await updateDatabase((database) => {
    const requester = findUser(database, req.rootUserId);
    if (database.settings?.featureFlags?.games === false) {
      return noDatabaseWrite(error('GAMES_DISABLED', 'Games are temporarily unavailable.', 503));
    }
    if (hasActiveRestriction(requester, 'matchmakingRestrictedUntil')) {
      return noDatabaseWrite(error('MATCHMAKING_RESTRICTED', 'Your account is temporarily restricted from starting games.', 403));
    }
    const chat = resolveDirectConversation(database, chatId, req.rootUserId);
    if (!chat) return noDatabaseWrite(error('NOT_A_PARTICIPANT', 'Games are available in private two-person conversations only.', 403));
    const opponentId = chat.users.find((id) => id !== req.rootUserId);
    if (!findUser(database, opponentId)) return noDatabaseWrite(error('NOT_A_PARTICIPANT', 'The other player is unavailable.', 404));

    const nowTime = Date.now();
    const now = new Date(nowTime).toISOString();
    const match = {
      id: createId(),
      conversationId: chatId,
      gameType,
      schemaVersion: SCHEMA_VERSION,
      rulesetVersion: game.rulesetVersion,
      physicsVersion: null,
      player1Id: req.rootUserId,
      player2Id: opponentId,
      activePlayerId: null,
      status: 'INVITED',
      currentTurn: 0,
      revision: 0,
      gameConfig: game.gameConfig,
      authoritativeState: game.createState(),
      winnerId: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      expiresAt: gameInvitationExpiresAt(nowTime),
    };
    database.games.push(match);
    const invite = {
      _id: createId(),
      sender: req.rootUserId,
      chatId,
      type: 'game_invite',
      gameId: match.id,
      gameType: match.gameType,
      gameStatus: match.status,
      gameTurn: 0,
      gameActivePlayerId: null,
      gameWinnerId: null,
      message: game.inviteText,
      createdAt: now,
      updatedAt: now,
      deliveredAt: now,
      scheduledFor: null,
      expiresAt: null,
    };
    database.messages.push(invite);
    chat.latestMessage = invite._id;
    chat.updatedAt = now;
    return { match: matchResponse(database, match, req.rootUserId), invite: expandMessage(database, invite) };
  });
  return sendResult(res, result, 201);
};

export const getMatch = async (req, res) => {
  const database = await getDatabase();
  const match = database.games.find((item) => item.id === req.params.matchId);
  if (!canAccessMatch(match, req.rootUserId)) return sendResult(res, error('NOT_A_PARTICIPANT', 'Match not found.', 404));
  if (hasGameInvitationExpired(match)) {
    const result = await updateDatabase((currentDatabase) => {
      const currentMatch = currentDatabase.games.find((item) => item.id === req.params.matchId);
      if (!canAccessMatch(currentMatch, req.rootUserId)) return noDatabaseWrite(error('NOT_A_PARTICIPANT', 'Match not found.', 404));
      expireInviteIfNeeded(currentDatabase, currentMatch);
      return actionResult(currentDatabase, currentMatch, req.rootUserId);
    });
    return sendResult(res, result);
  }
  if (finishTimedWordHuntIfNeeded(database, match)) {
    const result = await updateDatabase((currentDatabase) => {
      const currentMatch = currentDatabase.games.find((item) => item.id === req.params.matchId);
      if (!canAccessMatch(currentMatch, req.rootUserId)) return noDatabaseWrite(error('NOT_A_PARTICIPANT', 'Match not found.', 404));
      finishTimedWordHuntIfNeeded(currentDatabase, currentMatch);
      return actionResult(currentDatabase, currentMatch, req.rootUserId);
    });
    return sendResult(res, result);
  }
  return res.status(200).json({ match: matchResponse(database, match, req.rootUserId) });
};

export const getConversationMatches = async (req, res) => {
  const database = await getDatabase();
  const chat = resolveDirectConversation(database, req.params.conversationId, req.rootUserId);
  if (!chat) return sendResult(res, error('NOT_A_PARTICIPANT', 'Conversation not found.', 404));
  const hasExpiredInvitation = database.games.some((match) => match.conversationId === chat._id && canAccessMatch(match, req.rootUserId) && hasGameInvitationExpired(match));
  if (hasExpiredInvitation) {
    const result = await updateDatabase((currentDatabase) => {
      const currentChat = resolveDirectConversation(currentDatabase, req.params.conversationId, req.rootUserId);
      if (!currentChat) return noDatabaseWrite(error('NOT_A_PARTICIPANT', 'Conversation not found.', 404));
      currentDatabase.games
        .filter((match) => match.conversationId === currentChat._id && canAccessMatch(match, req.rootUserId))
        .forEach((match) => expireInviteIfNeeded(currentDatabase, match));
      const matches = currentDatabase.games
        .filter((match) => match.conversationId === currentChat._id && canAccessMatch(match, req.rootUserId))
        .sort((first, second) => new Date(second.updatedAt) - new Date(first.updatedAt))
        .map((match) => matchResponse(currentDatabase, match, req.rootUserId));
      return { matches };
    });
    return sendResult(res, result);
  }
  const matches = database.games
    .filter((match) => match.conversationId === chat._id && canAccessMatch(match, req.rootUserId))
    .sort((first, second) => new Date(second.updatedAt) - new Date(first.updatedAt))
    .map((match) => matchResponse(database, match, req.rootUserId));
  return res.status(200).json({ matches });
};

function respondToInvite(status) {
  return async (req, res) => {
    const result = await updateDatabase((database) => {
      const match = database.games.find((item) => item.id === req.params.matchId);
      if (!canAccessMatch(match, req.rootUserId)) return noDatabaseWrite(error('NOT_A_PARTICIPANT', 'Match not found.', 404));
      if (match.player2Id !== req.rootUserId) return noDatabaseWrite(error('NOT_A_PARTICIPANT', 'Only the invited player can respond.', 403));
      if (expireInviteIfNeeded(database, match)) return error('INVITATION_EXPIRED', 'This game invitation expired after one hour.', 409);
      if (match.status !== 'INVITED') return noDatabaseWrite(error('INVALID_ACTION', 'This invitation has already been answered.', 409));

      const now = new Date().toISOString();
      match.status = status;
      match.activePlayerId = status === 'ACTIVE' ? match.player1Id : null;
      if (status === 'ACTIVE' && match.gameType === 'word-hunt') {
        match.authoritativeState = { ...match.authoritativeState, startedAt: now, roundEndsAt: new Date(Date.now() + 120_000).toISOString() };
      }
      match.updatedAt = now;
      match.revision += 1;
      updateInviteMessage(database, match);
      return actionResult(database, match, req.rootUserId);
    });
    return sendResult(res, result);
  };
}

export const acceptMatch = respondToInvite('ACTIVE');
export const declineMatch = respondToInvite('CANCELLED');

export const submitAction = async (req, res) => {
  const { actionId, expectedRevision, turnNumber, actionType, actionPayload, clientRulesetVersion } = req.body;
  if (typeof actionId !== 'string' || actionId.length < 8 || actionId.length > 100) {
    return sendResult(res, error('INVALID_ACTION', 'A valid action ID is required.'));
  }
  if (!Number.isInteger(expectedRevision) || !Number.isInteger(turnNumber)) {
    return sendResult(res, error('INVALID_ACTION', 'The game action is invalid.'));
  }

  const result = await updateDatabase((database) => {
    const existingAction = database.gameActions.find((item) => item.id === actionId);
    if (existingAction) {
      if (existingAction.matchId !== req.params.matchId || existingAction.actorId !== req.rootUserId) {
        return noDatabaseWrite(error('INVALID_ACTION', 'This action ID is already in use.', 409));
      }
      return noDatabaseWrite(existingAction.resultPayload);
    }

    const match = database.games.find((item) => item.id === req.params.matchId);
    if (!canAccessMatch(match, req.rootUserId)) return noDatabaseWrite(error('NOT_A_PARTICIPANT', 'Match not found.', 404));
    if (finishTimedWordHuntIfNeeded(database, match)) return actionResult(database, match, req.rootUserId);
    if (!MATCH_STATUSES.has(match.status) || match.status !== 'ACTIVE') return noDatabaseWrite(error('MATCH_COMPLETED', 'This match is no longer active.', 409));
    if (clientRulesetVersion !== undefined && clientRulesetVersion !== match.rulesetVersion) return noDatabaseWrite(error('VERSION_MISMATCH', 'Update the app before playing this match.', 409));
    if (expectedRevision !== match.revision) return noDatabaseWrite(error('STALE_REVISION', 'Your game view is out of date. Refreshing it now.', 409));
    if (turnNumber !== match.currentTurn || match.activePlayerId !== req.rootUserId) return noDatabaseWrite(error('NOT_YOUR_TURN', 'Wait for the other player to move.', 409));

    const mark = match.player1Id === req.rootUserId ? 1 : 2;
    const action = match.gameType === 'tic-tac-toe'
      ? actionType === 'MOVE' ? applyTicTacToeMove(match.authoritativeState, mark, actionPayload?.cell) : { error: 'INVALID_ACTION', message: 'Choose a valid Tic-Tac-Toe move.' }
      : match.gameType === 'mini-golf'
        ? actionType === 'SHOT' ? applyMiniGolfShot(match.authoritativeState, mark, actionPayload) : { error: 'INVALID_ACTION', message: 'Choose a valid Mini Golf shot.' }
        : match.gameType === 'filler'
          ? actionType === 'COLOR' ? applyFillerMove(match.authoritativeState, mark, actionPayload?.color) : { error: 'INVALID_ACTION', message: 'Choose a colour.' }
          : match.gameType === 'word-hunt'
            ? actionType === 'WORD' ? applyWordHuntWord(match.authoritativeState, mark, actionPayload?.path) : { error: 'INVALID_ACTION', message: 'Trace a word.' }
            : match.gameType === 'knockout'
              ? actionType === 'PUSH' ? applyKnockoutPush(match.authoritativeState, mark, actionPayload) : { error: 'INVALID_ACTION', message: 'Make a push.' }
              : match.gameType === 'crazy-8-ball'
                ? actionType === 'SHOT' ? applyEightBallShot(match.authoritativeState, mark, actionPayload) : { error: 'INVALID_ACTION', message: 'Take a cue shot.' }
                : { error: 'INVALID_ACTION', message: 'This game is unavailable.' };
    if (action.error) return noDatabaseWrite(error(action.error, action.message));

    const now = new Date().toISOString();
    match.authoritativeState = action.state;
    match.currentTurn += 1;
    match.revision += 1;
    match.updatedAt = now;
    if (action.completed || action.draw) {
      match.status = action.draw ? 'DRAW' : 'COMPLETED';
      const winnerMark = action.winnerMark || (action.completed ? mark : null);
      match.winnerId = winnerMark ? (winnerMark === 1 ? match.player1Id : match.player2Id) : null;
      match.activePlayerId = null;
      match.completedAt = now;
    } else {
      const nextMark = action.nextPlayerMark || (match.player1Id === req.rootUserId ? 2 : 1);
      match.activePlayerId = nextMark === 1 ? match.player1Id : match.player2Id;
    }
    updateInviteMessage(database, match);
    const payload = actionResult(database, match, req.rootUserId);
    database.gameActions.push({
      id: actionId,
      matchId: match.id,
      actorId: req.rootUserId,
      actionNumber: match.currentTurn,
      expectedRevision,
      actionType,
      actionPayload: match.gameType === 'tic-tac-toe' ? { cell: actionPayload.cell } : actionPayload,
      resultingRevision: match.revision,
      resultPayload: payload,
      createdAt: now,
    });
    return payload;
  });
  return sendResult(res, result);
};

export const forfeitMatch = async (req, res) => {
  const result = await updateDatabase((database) => {
    const match = database.games.find((item) => item.id === req.params.matchId);
    if (!canAccessMatch(match, req.rootUserId)) return noDatabaseWrite(error('NOT_A_PARTICIPANT', 'Match not found.', 404));
    if (match.status !== 'ACTIVE') return noDatabaseWrite(error('MATCH_COMPLETED', 'This match is no longer active.', 409));
    const now = new Date().toISOString();
    match.status = 'FORFEITED';
    match.winnerId = match.player1Id === req.rootUserId ? match.player2Id : match.player1Id;
    match.activePlayerId = null;
    match.completedAt = now;
    match.updatedAt = now;
    match.revision += 1;
    updateInviteMessage(database, match);
    return actionResult(database, match, req.rootUserId);
  });
  return sendResult(res, result);
};
