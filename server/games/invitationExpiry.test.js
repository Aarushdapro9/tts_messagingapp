import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_INVITATION_LIFETIME_MS, expireGameInvitation, gameInvitationExpiresAt, hasGameInvitationExpired } from './invitationExpiry.js';

test('unanswered game invitations expire exactly one hour after creation', () => {
  const createdAt = Date.parse('2026-11-01T00:00:00.000Z');
  const match = { status: 'INVITED', createdAt: new Date(createdAt).toISOString(), expiresAt: gameInvitationExpiresAt(createdAt), revision: 4, activePlayerId: 'player-1' };

  assert.equal(GAME_INVITATION_LIFETIME_MS, 60 * 60 * 1000);
  assert.equal(hasGameInvitationExpired(match, createdAt + GAME_INVITATION_LIFETIME_MS - 1), false);
  assert.equal(expireGameInvitation(match, createdAt + GAME_INVITATION_LIFETIME_MS), true);
  assert.equal(match.status, 'EXPIRED');
  assert.equal(match.activePlayerId, null);
  assert.equal(match.revision, 5);
  assert.ok(match.completedAt);
});

test('answered and malformed-time invitations are not incorrectly expired', () => {
  assert.equal(expireGameInvitation({ status: 'ACTIVE', expiresAt: '2020-01-01T00:00:00.000Z' }), false);
  assert.equal(hasGameInvitationExpired({ status: 'INVITED', expiresAt: 'not-a-date' }), false);
});
