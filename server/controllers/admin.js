import {
  createId,
  expandChat,
  expandMessage,
  findUser,
  getDatabase,
  publishAndPruneMessages,
  updateDatabase,
  withoutPassword,
} from '../storage/store.js';
import { getUserTitle, isAdminUser, isOwnerEmail } from '../middleware/user.js';

function safeAdminUser(user) {
  return {
    ...withoutPassword(user),
    title: getUserTitle(user),
    isAdmin: isAdminUser(user),
    isOwner: isOwnerEmail(user.email),
    approved: user.approved !== false,
  };
}

function safeAlert(alert) {
  return {
    _id: alert._id,
    title: alert.title,
    message: alert.message,
    type: alert.type === 'alert' ? 'alert' : 'notification',
    createdAt: alert.createdAt,
  };
}

export const getAdminOverview = async (req, res) => {
  try {
    const database = await getDatabase();
    const users = database.users
      .map(safeAdminUser)
      .sort((first, second) => (first.name || first.email).localeCompare(second.name || second.email));
    const chats = database.chats
      .map((chat) => expandChat(database, chat))
      .sort((first, second) => new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0));

    return res.status(200).json({
      users,
      chats,
      capabilities: {
        canManageRoles: isOwnerEmail(req.rootUser?.email),
        currentUserId: req.rootUserId,
      },
    });
  } catch (error) {
    console.error('Admin overview failed:', error);
    return res.status(500).json({ message: 'Unable to load the admin panel.' });
  }
};

export const updateUserRole = async (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  if (!title || title.length > 32) {
    return res.status(400).json({ message: 'A title between 1 and 32 characters is required.' });
  }
  if (title.toLowerCase() === 'owner') {
    return res.status(400).json({ message: 'Owner is a reserved title.' });
  }

  const account = await updateDatabase((database) => {
    const storedAccount = findUser(database, req.params.userId);
    if (!storedAccount || isOwnerEmail(storedAccount.email)) return null;
    storedAccount.title = title;
    storedAccount.isAdmin = Boolean(req.body.isAdmin);
    storedAccount.updatedAt = new Date().toISOString();
    return safeAdminUser(storedAccount);
  });

  if (!account) {
    return res.status(404).json({ message: 'That user cannot be changed.' });
  }
  return res.status(200).json({ user: account });
};

export const updateUserApproval = async (req, res) => {
  const account = await updateDatabase((database) => {
    const storedAccount = findUser(database, req.params.userId);
    if (!storedAccount || isOwnerEmail(storedAccount.email)) return null;
    storedAccount.approved = Boolean(req.body.approved);
    storedAccount.updatedAt = new Date().toISOString();
    return safeAdminUser(storedAccount);
  });
  if (!account) return res.status(404).json({ message: 'That user cannot be changed.' });
  return res.status(200).json({ user: account });
};

export const deleteUserAccount = async (req, res) => {
  if (req.params.userId === req.rootUserId) {
    return res.status(400).json({ message: 'You cannot delete your own account from the admin panel.' });
  }

  const result = await updateDatabase((database) => {
    const account = findUser(database, req.params.userId);
    if (!account) return null;
    if (isOwnerEmail(account.email)) return 'owner';

    const deletedUserId = account._id;
    const removedChatIds = new Set();
    for (const chat of database.chats) {
      if (chat.isGlobal || !chat.users?.includes(deletedUserId)) continue;
      chat.users = chat.users.filter((id) => id !== deletedUserId);
      if (chat.groupAdmin === deletedUserId) chat.groupAdmin = chat.users[0] || null;
      if (chat.isOnboarding || !chat.isGroup || chat.users.length < 2) removedChatIds.add(chat._id);
    }
    database.chats = database.chats.filter((chat) => !removedChatIds.has(chat._id));

    const removedGameIds = new Set(
      (database.games || [])
        .filter((game) => game.player1Id === deletedUserId || game.player2Id === deletedUserId)
        .map((game) => game.id)
    );
    database.games = (database.games || []).filter((game) => !removedGameIds.has(game.id));
    database.gameActions = (database.gameActions || []).filter((action) => !removedGameIds.has(action.matchId));

    database.messages = database.messages.filter((message) =>
      message.sender !== deletedUserId &&
      !removedChatIds.has(message.chatId) &&
      !removedGameIds.has(message.gameId)
    );
    database.users = database.users.filter((user) => user._id !== deletedUserId).map((user) => ({
      ...user,
      contacts: (user.contacts || []).filter((id) => id !== deletedUserId),
      chatFolders: user.chatFolders
        ? Object.fromEntries(Object.entries(user.chatFolders).map(([folder, ids]) => [folder, (ids || []).filter((id) => !removedChatIds.has(id))]))
        : user.chatFolders,
    }));
    database.alerts = (database.alerts || []).map((alert) => ({
      ...alert,
      recipientIds: Array.isArray(alert.recipientIds) ? alert.recipientIds.filter((id) => id !== deletedUserId) : alert.recipientIds,
      dismissedBy: (alert.dismissedBy || []).filter((id) => id !== deletedUserId),
    }));
    publishAndPruneMessages(database);
    return { deletedUserId, removedChatIds: [...removedChatIds] };
  });

  if (result === 'owner') return res.status(403).json({ message: 'The Owner account cannot be deleted.' });
  if (!result) return res.status(404).json({ message: 'Account not found.' });
  return res.status(200).json(result);
};

export const getAdminChatMessages = async (req, res) => {
  try {
    const database = await getDatabase();
    const chat = database.chats.find((item) => item._id === req.params.chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const messages = database.messages
      .filter((message) => message.chatId === chat._id)
      .sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt))
      .map((message) => expandMessage(database, message));

    return res.status(200).json({ chat: expandChat(database, chat), messages });
  } catch (error) {
    console.error('Admin messages failed:', error);
    return res.status(500).json({ message: 'Unable to load this conversation.' });
  }
};

export const createAppAlert = async (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  const type = req.body.type === 'alert' ? 'alert' : 'notification';

  if (!title || title.length > 80 || !message || message.length > 500) {
    return res.status(400).json({ message: 'Use a title up to 80 characters and a message up to 500 characters.' });
  }

  const alert = await updateDatabase((database) => {
    const nextAlert = {
      _id: createId(),
      title,
      message,
      type,
      recipientIds: database.users.map((user) => user._id),
      dismissedBy: [],
      createdAt: new Date().toISOString(),
    };
    database.alerts = Array.isArray(database.alerts) ? database.alerts : [];
    database.alerts.push(nextAlert);
    return safeAlert(nextAlert);
  });

  return res.status(201).json({ alert });
};

export const getPendingAlerts = async (req, res) => {
  try {
    const database = await getDatabase();
    const alerts = (database.alerts || [])
      .filter((alert) =>
        (!Array.isArray(alert.recipientIds) || alert.recipientIds.includes(req.rootUserId)) &&
        !alert.dismissedBy?.includes(req.rootUserId)
      )
      .sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt))
      .map(safeAlert);
    return res.status(200).json({ alerts });
  } catch (error) {
    console.error('Loading app alerts failed:', error);
    return res.status(500).json({ message: 'Unable to load app alerts.' });
  }
};

export const dismissAppAlert = async (req, res) => {
  const dismissed = await updateDatabase((database) => {
    const alert = (database.alerts || []).find((item) => item._id === req.params.alertId);
    if (!alert || (Array.isArray(alert.recipientIds) && !alert.recipientIds.includes(req.rootUserId))) return null;
    alert.dismissedBy = Array.isArray(alert.dismissedBy) ? alert.dismissedBy : [];
    if (!alert.dismissedBy.includes(req.rootUserId)) alert.dismissedBy.push(req.rootUserId);
    return true;
  });
  if (!dismissed) return res.status(404).json({ message: 'Alert not found.' });
  return res.status(204).end();
};
