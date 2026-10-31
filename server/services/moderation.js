import { createId } from '../storage/store.js';

export function ensureModerationState(database) {
  database.reports ||= [];
  database.moderationActions ||= [];
  database.auditLogs ||= [];
  database.sessions ||= [];
  database.loginAttempts ||= [];
  database.settings ||= {};
  database.settings.featureFlags ||= { games: true, polls: true };
  return database;
}

export function appendAudit(database, actorId, action, targetType, targetId, metadata = {}) {
  ensureModerationState(database);
  database.auditLogs.push({
    id: createId(), actorId, action, targetType, targetId,
    metadata, createdAt: new Date().toISOString(),
  });
}

export function appendModerationAction(database, actorId, userId, type, details = {}) {
  ensureModerationState(database);
  const action = { id: createId(), actorId, userId, type, details, createdAt: new Date().toISOString() };
  database.moderationActions.push(action);
  appendAudit(database, actorId, `moderation.${type}`, 'user', userId, details);
  return action;
}

export function accountStatus(user, now = Date.now()) {
  const restrictions = user?.restrictions || {};
  if (restrictions.bannedAt) return 'Banned';
  if (restrictions.suspendedUntil && new Date(restrictions.suspendedUntil).getTime() > now) return 'Suspended';
  return user?.approved === false ? 'Pending' : 'Active';
}

export function hasActiveRestriction(user, name, now = Date.now()) {
  const value = user?.restrictions?.[name];
  return Boolean(value && (value === true || new Date(value).getTime() > now));
}
