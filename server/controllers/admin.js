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
import { accountStatus, appendAudit, appendModerationAction, ensureModerationState } from '../services/moderation.js';

function safeAdminUser(user) {
  return {
    ...withoutPassword(user),
    title: getUserTitle(user),
    isAdmin: isAdminUser(user),
    isOwner: isOwnerEmail(user.email),
    approved: user.approved !== false,
    status: accountStatus(user),
    lastActiveAt: user.lastActiveAt || null,
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
    ensureModerationState(database);
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
      stats: {
        reportsPending: database.reports.filter((report) => report.status === 'pending').length,
        suspended: users.filter((user) => user.status === 'Suspended').length,
        banned: users.filter((user) => user.status === 'Banned').length,
        messagesToday: database.messages.filter((message) => new Date(message.createdAt).toDateString() === new Date().toDateString()).length,
        completedGames: (database.games || []).filter((game) => ['COMPLETED', 'DRAW', 'FORFEITED'].includes(game.status)).length,
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
    appendAudit(database, req.rootUserId, 'user.role.updated', 'user', storedAccount._id, { title, isAdmin: storedAccount.isAdmin });
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
    appendAudit(database, req.rootUserId, 'user.approval.updated', 'user', storedAccount._id, { approved: storedAccount.approved });
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
    appendAudit(database, req.rootUserId, 'user.deleted', 'user', deletedUserId, { removedChatCount: removedChatIds.size });
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
    appendAudit(database, req.rootUserId, 'alert.created', 'alert', nextAlert._id, { type: nextAlert.type });
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

const moderationKinds = new Set(['suspend', 'ban', 'clear', 'mute_chat', 'ban_global', 'restrict_matchmaking']);

export const updateUserModeration = async (req, res) => {
  const { kind, until, note = '' } = req.body;
  if (!moderationKinds.has(kind)) return res.status(400).json({ message: 'Unknown moderation action.' });
  const result = await updateDatabase((database) => {
    const user = findUser(database, req.params.userId);
    if (!user || user._id === req.rootUserId || isOwnerEmail(user.email)) return null;
    user.restrictions ||= {};
    if (kind === 'clear') user.restrictions = {};
    else if (kind === 'ban') user.restrictions.bannedAt = new Date().toISOString();
    else {
      const parsedUntil = new Date(until).getTime();
      if (!Number.isFinite(parsedUntil) || parsedUntil <= Date.now()) return 'invalidUntil';
      const field = { suspend: 'suspendedUntil', mute_chat: 'chatMutedUntil', ban_global: 'globalChatBannedUntil', restrict_matchmaking: 'matchmakingRestrictedUntil' }[kind];
      user.restrictions[field] = new Date(parsedUntil).toISOString();
    }
    user.updatedAt = new Date().toISOString();
    appendModerationAction(database, req.rootUserId, user._id, kind, { until: until || null, note: String(note).slice(0, 500) });
    return safeAdminUser(user);
  });
  if (result === 'invalidUntil') return res.status(400).json({ message: 'Choose a future end time.' });
  if (!result) return res.status(404).json({ message: 'That account cannot be moderated.' });
  return res.status(200).json({ user: result });
};

export const getAuditLogs = async (_req, res) => {
  const database = await getDatabase();
  ensureModerationState(database);
  return res.status(200).json({ logs: database.auditLogs.slice(-500).reverse() });
};

export const getReports = async (_req, res) => {
  const database = await getDatabase();
  ensureModerationState(database);
  return res.status(200).json({ reports: database.reports.slice().reverse() });
};

export const updateReport = async (req, res) => {
  const { status, note = '' } = req.body;
  if (!['pending', 'reviewing', 'resolved', 'dismissed'].includes(status)) return res.status(400).json({ message: 'Invalid report status.' });
  const report = await updateDatabase((database) => {
    const item = (database.reports || []).find((entry) => entry.id === req.params.reportId);
    if (!item) return null;
    item.status = status; item.moderatorNotes ||= [];
    if (note.trim()) item.moderatorNotes.push({ actorId: req.rootUserId, note: note.trim().slice(0, 1000), createdAt: new Date().toISOString() });
    item.updatedAt = new Date().toISOString();
    appendAudit(database, req.rootUserId, 'report.updated', 'report', item.id, { status });
    return item;
  });
  if (!report) return res.status(404).json({ message: 'Report not found.' });
  return res.status(200).json({ report });
};

export const createReport = async (req, res) => {
  const { targetType, targetId, reason, priority = 'normal' } = req.body;
  if (!['user', 'message', 'conversation', 'game'].includes(targetType) || !targetId || !reason?.trim()) return res.status(400).json({ message: 'Choose a target and provide a reason.' });
  const report = await updateDatabase((database) => {
    ensureModerationState(database);
    const item = { id: createId(), reporterId: req.rootUserId, targetType, targetId, reason: reason.trim().slice(0, 1000), priority: ['low', 'normal', 'high'].includes(priority) ? priority : 'normal', status: 'pending', moderatorNotes: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    database.reports.push(item);
    appendAudit(database, req.rootUserId, 'report.created', 'report', item.id, { targetType, targetId });
    return item;
  });
  return res.status(201).json({ report });
};

function publicSystemSettings(database) {
  ensureModerationState(database);
  return {
    registrationMode: database.settings.registrationMode,
    maintenanceMode: Boolean(database.settings.maintenanceMode),
    globalChatLocked: Boolean(database.settings.globalChatLocked),
    globalChatSlowModeSeconds: Number(database.settings.globalChatSlowModeSeconds || 0),
    featureFlags: { ...database.settings.featureFlags },
  };
}

export const getSystemSettings = async (_req, res) => {
  const database = await getDatabase();
  return res.status(200).json({ settings: publicSystemSettings(database) });
};

export const updateSystemSettings = async (req, res) => {
  const result = await updateDatabase((database) => {
    ensureModerationState(database);
    const next = req.body || {};
    if (next.registrationMode !== undefined) {
      if (!['open', 'invite_only'].includes(next.registrationMode)) return 'invalid';
      database.settings.registrationMode = next.registrationMode;
    }
    for (const field of ['maintenanceMode', 'globalChatLocked']) {
      if (next[field] !== undefined) {
        if (typeof next[field] !== 'boolean') return 'invalid';
        database.settings[field] = next[field];
      }
    }
    if (next.globalChatSlowModeSeconds !== undefined) {
      const seconds = Number(next.globalChatSlowModeSeconds);
      if (!Number.isInteger(seconds) || seconds < 0 || seconds > 300) return 'invalid';
      database.settings.globalChatSlowModeSeconds = seconds;
    }
    if (next.featureFlags !== undefined) {
      if (!next.featureFlags || typeof next.featureFlags !== 'object') return 'invalid';
      for (const field of ['games', 'polls']) {
        if (next.featureFlags[field] !== undefined) {
          if (typeof next.featureFlags[field] !== 'boolean') return 'invalid';
          database.settings.featureFlags[field] = next.featureFlags[field];
        }
      }
    }
    appendAudit(database, req.rootUserId, 'system.settings.updated', 'system', 'settings', publicSystemSettings(database));
    return publicSystemSettings(database);
  });
  if (result === 'invalid') return res.status(400).json({ message: 'One or more settings are invalid.' });
  return res.status(200).json({ settings: result });
};

export const exportOwnerData = async (_req, res) => {
  const database = await getDatabase();
  ensureModerationState(database);
  const exportData = {
    exportedAt: new Date().toISOString(),
    users: database.users.map((user) => withoutPassword(user)),
    chats: database.chats,
    messages: database.messages,
    reports: database.reports,
    moderationActions: database.moderationActions,
    auditLogs: database.auditLogs,
    games: database.games || [],
  };
  res.setHeader('Content-Disposition', 'attachment; filename="messaging-app-owner-export.json"');
  return res.status(200).json(exportData);
};

export const cancelGameAsAdmin = async (req, res) => {
  const result = await updateDatabase((database) => {
    const game = (database.games || []).find((item) => item.id === req.params.matchId);
    if (!game) return null;
    if (!['INVITED', 'ACTIVE'].includes(game.status)) return 'completed';
    game.status = 'CANCELLED';
    game.activePlayerId = null;
    game.completedAt = new Date().toISOString();
    game.updatedAt = game.completedAt;
    game.revision = Number(game.revision || 0) + 1;
    const invite = database.messages.find((message) => message.type === 'game_invite' && message.gameId === game.id);
    if (invite) { invite.gameStatus = game.status; invite.updatedAt = game.updatedAt; }
    appendAudit(database, req.rootUserId, 'game.cancelled', 'game', game.id, { status: game.status });
    return { id: game.id, status: game.status };
  });
  if (result === 'completed') return res.status(409).json({ message: 'Completed matches cannot be cancelled.' });
  if (!result) return res.status(404).json({ message: 'Match not found.' });
  return res.status(200).json({ match: result });
};
