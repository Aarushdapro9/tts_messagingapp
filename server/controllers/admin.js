import {
  expandChat,
  expandMessage,
  findUser,
  getDatabase,
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
