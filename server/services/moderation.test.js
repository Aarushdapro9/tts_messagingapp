import test from 'node:test';
import assert from 'node:assert/strict';
import { accountStatus, ensureModerationState, hasActiveRestriction } from './moderation.js';

test('moderation state safely extends existing application data', () => {
  const database = { users: [] };
  ensureModerationState(database);
  assert.deepEqual(database.reports, []);
  assert.equal(database.settings.featureFlags.games, true);
});

test('account status prioritizes a permanent ban and expires temporary restrictions', () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const past = new Date(Date.now() - 60_000).toISOString();
  assert.equal(accountStatus({ approved: true, restrictions: { suspendedUntil: future } }), 'Suspended');
  assert.equal(accountStatus({ approved: true, restrictions: { bannedAt: future, suspendedUntil: past } }), 'Banned');
  assert.equal(accountStatus({ approved: false, restrictions: { suspendedUntil: past } }), 'Pending');
  assert.equal(hasActiveRestriction({ restrictions: { chatMutedUntil: future } }, 'chatMutedUntil'), true);
  assert.equal(hasActiveRestriction({ restrictions: { chatMutedUntil: past } }, 'chatMutedUntil'), false);
});
