import axios from 'axios';

const serverUrl = process.env.REACT_APP_SERVER_URL || '';

function api() {
  return axios.create({
    baseURL: serverUrl,
    headers: { Authorization: localStorage.getItem('userToken') },
  });
}

export async function createGameMatch(chatId, gameType, mapId) {
  const { data } = await api().post('/api/games/matches', { chatId, gameType, mapId });
  return data;
}

export async function fetchGameMatch(matchId) {
  const { data } = await api().get(`/api/games/matches/${matchId}`);
  return data.match;
}

export async function fetchConversationMatches(conversationId) {
  const { data } = await api().get(`/api/games/conversations/${conversationId}/matches`);
  return data.matches || [];
}

export async function acceptGameMatch(matchId) {
  const { data } = await api().post(`/api/games/matches/${matchId}/accept`);
  return data.match;
}

export async function declineGameMatch(matchId) {
  const { data } = await api().post(`/api/games/matches/${matchId}/decline`);
  return data.match;
}

export async function submitGameAction(match, actionType, actionPayload) {
  const actionId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { data } = await api().post(`/api/games/matches/${match.id}/actions`, {
    actionId,
    expectedRevision: match.revision,
    turnNumber: match.currentTurn,
    actionType,
    actionPayload,
    clientRulesetVersion: match.rulesetVersion,
  });
  return data.match;
}

export async function forfeitGameMatch(matchId) {
  const { data } = await api().post(`/api/games/matches/${matchId}/forfeit`);
  return data.match;
}
