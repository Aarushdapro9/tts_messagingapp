import test from 'node:test';
import assert from 'node:assert/strict';
import { markDirectMessagesRead } from './readReceipts.js';

test('read receipts only mark delivered messages from the other direct-chat member once', () => {
  const chat = { _id: 'chat', users: ['a', 'b'], isGroup: false, isGlobal: false };
  const database = { messages: [{ _id: 'one', chatId: 'chat', sender: 'a', deliveredAt: '2026-01-01T00:00:00.000Z' }, { _id: 'two', chatId: 'chat', sender: 'b', deliveredAt: '2026-01-01T00:00:00.000Z' }] };
  const first = markDirectMessagesRead(database, chat, 'b', '2026-01-01T00:01:00.000Z');
  assert.deepEqual(first.updates[0].messageIds, ['one']);
  assert.equal(database.messages[0].readBy.b, '2026-01-01T00:01:00.000Z');
  assert.equal(markDirectMessagesRead(database, chat, 'b').updates.length, 0);
});
