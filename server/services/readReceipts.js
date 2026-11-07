export function isDirectChat(chat) {
  return Boolean(chat && !chat.isGlobal && !chat.isGroup && Array.isArray(chat.users) && chat.users.length === 2);
}

// Returns only newly changed message ids so a refresh/reconnect is idempotent
// and does not produce an expensive full-state write when nothing was viewed.
export function markDirectMessagesRead(database, chat, readerId, now = new Date().toISOString()) {
  if (!isDirectChat(chat) || !chat.users.includes(readerId)) return { updates: [] };
  const bySender = new Map();
  database.messages.forEach((message) => {
    if (message.chatId !== chat._id || message.sender === readerId || !message.deliveredAt || message.expiresAt && new Date(message.expiresAt).getTime() <= Date.now()) return;
    message.readBy ||= {};
    if (message.readBy[readerId]) return;
    message.readBy[readerId] = now;
    const senderUpdates = bySender.get(message.sender) || [];
    senderUpdates.push(message._id); bySender.set(message.sender, senderUpdates);
  });
  return { updates: [...bySender.entries()].map(([senderId, messageIds]) => ({ senderId, messageIds, readerId, readAt: now })) };
}
