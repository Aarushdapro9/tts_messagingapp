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
import { hasActiveRestriction } from '../services/moderation.js';

const GAME_TYPE = 'tic-tac-toe';
const SCHEMA_VERSION = 1;
const MATCH_STATUSES = new Set(['CREATED', 'INVITED', 'ACTIVE', 'COMPLETED', 'DRAW', 'FORFEITED', 'EXPIRED', 'CANCELLED']);

function error(code, message, status = 400) {
  return { error: true, code, message, status };
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
  const { chatId, gameType } = req.body;
  if (gameType !== GAME_TYPE) {
    return sendResult(res, error('INVALID_ACTION', 'Only Tic-Tac-Toe is available right now.'));
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

    const now = new Date().toISOString();
    const match = {
      id: createId(),
      conversationId: chatId,
      gameType: GAME_TYPE,
      schemaVersion: SCHEMA_VERSION,
      rulesetVersion: TIC_TAC_TOE_RULESET_VERSION,
      physicsVersion: null,
      player1Id: req.rootUserId,
      player2Id: opponentId,
      activePlayerId: null,
      status: 'INVITED',
      currentTurn: 0,
      revision: 0,
      gameConfig: { boardSize: 3 },
      authoritativeState: createTicTacToeState(),
      winnerId: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      expiresAt: null,
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
      message: 'Tic-Tac-Toe invitation',
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
  return res.status(200).json({ match: matchResponse(database, match, req.rootUserId) });
};

export const getConversationMatches = async (req, res) => {
  const database = await getDatabase();
  const chat = resolveDirectConversation(database, req.params.conversationId, req.rootUserId);
  if (!chat) return sendResult(res, error('NOT_A_PARTICIPANT', 'Conversation not found.', 404));
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
      if (match.status !== 'INVITED') return noDatabaseWrite(error('INVALID_ACTION', 'This invitation has already been answered.', 409));

      const now = new Date().toISOString();
      match.status = status;
      match.activePlayerId = status === 'ACTIVE' ? match.player1Id : null;
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
  if (!Number.isInteger(expectedRevision) || !Number.isInteger(turnNumber) || actionType !== 'MOVE') {
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
    if (!MATCH_STATUSES.has(match.status) || match.status !== 'ACTIVE') return noDatabaseWrite(error('MATCH_COMPLETED', 'This match is no longer active.', 409));
    if (clientRulesetVersion !== undefined && clientRulesetVersion !== match.rulesetVersion) return noDatabaseWrite(error('VERSION_MISMATCH', 'Update the app before playing this match.', 409));
    if (expectedRevision !== match.revision) return noDatabaseWrite(error('STALE_REVISION', 'Your game view is out of date. Refreshing it now.', 409));
    if (turnNumber !== match.currentTurn || match.activePlayerId !== req.rootUserId) return noDatabaseWrite(error('NOT_YOUR_TURN', 'Wait for the other player to move.', 409));

    const mark = match.player1Id === req.rootUserId ? 1 : 2;
    const move = applyTicTacToeMove(match.authoritativeState, mark, actionPayload?.cell);
    if (move.error) return noDatabaseWrite(error(move.error, move.message));

    const now = new Date().toISOString();
    match.authoritativeState = move.state;
    match.currentTurn += 1;
    match.revision += 1;
    match.updatedAt = now;
    if (move.completed) {
      match.status = 'COMPLETED';
      match.winnerId = req.rootUserId;
      match.activePlayerId = null;
      match.completedAt = now;
    } else if (move.draw) {
      match.status = 'DRAW';
      match.winnerId = null;
      match.activePlayerId = null;
      match.completedAt = now;
    } else {
      match.activePlayerId = match.player1Id === req.rootUserId ? match.player2Id : match.player1Id;
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
      actionPayload: { cell: actionPayload.cell },
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
