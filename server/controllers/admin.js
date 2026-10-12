import {
  expandChat,
  expandMessage,
  getDatabase,
  withoutPassword,
} from '../storage/store.js';

export const getAdminOverview = async (_req, res) => {
  const database = await getDatabase();
  const users = database.users
    .map(withoutPassword)
    .sort((first, second) => first.name.localeCompare(second.name));
  const chats = database.chats
    .map((chat) => expandChat(database, chat))
    .sort((first, second) => new Date(second.updatedAt) - new Date(first.updatedAt));

  return res.status(200).json({ users, chats });
};

export const getAdminChatMessages = async (req, res) => {
  const database = await getDatabase();
  const chat = database.chats.find((item) => item._id === req.params.chatId);
  if (!chat) return res.status(404).json({ message: 'Chat not found' });

  const messages = database.messages
    .filter((message) => message.chatId === chat._id)
    .sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt))
    .map((message) => expandMessage(database, message));

  return res.status(200).json({ chat: expandChat(database, chat), messages });
};
