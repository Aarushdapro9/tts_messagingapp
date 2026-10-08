import {
  createId,
  expandMessage,
  getDatabase,
  updateDatabase,
} from '../storage/store.js';

export const sendMessage = async (req, res) => {
  const { chatId, message } = req.body;
  if (!chatId || !message?.trim()) {
    return res.status(400).json({ message: 'A chat and message are required' });
  }

  try {
    const savedMessage = await updateDatabase((database) => {
      const chat = database.chats.find((item) => item._id === chatId);
      if (!chat || (!chat.isGlobal && !chat.users.includes(req.rootUserId))) return null;
      const now = new Date().toISOString();
      const newMessage = {
        _id: createId(),
        sender: req.rootUserId,
        message: message.trim(),
        chatId,
        createdAt: now,
        updatedAt: now,
      };
      database.messages.push(newMessage);
      chat.latestMessage = newMessage._id;
      chat.updatedAt = now;
      return expandMessage(database, newMessage);
    });
    if (!savedMessage) return res.status(404).json({ message: 'Chat not found' });
    return res.status(201).json(savedMessage);
  } catch (error) {
    console.error('Sending message failed:', error);
    return res.status(500).json({ message: 'Unable to send message' });
  }
};

export const getMessages = async (req, res) => {
  const { chatId } = req.params;
  const database = await getDatabase();
  const chat = database.chats.find((item) => item._id === chatId);
  if (!chat || (!chat.isGlobal && !chat.users.includes(req.rootUserId))) {
    return res.status(404).json({ message: 'Chat not found' });
  }
  const messages = database.messages
    .filter((message) => message.chatId === chatId)
    .sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt))
    .map((message) => expandMessage(database, message));
  return res.status(200).json(messages);
};
