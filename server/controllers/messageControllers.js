import {
  createId,
  expandMessage,
  findUser,
  getDatabase,
  publishAndPruneMessages,
  updateDatabase,
} from '../storage/store.js';

function canAccess(chat, userId) {
  return chat && (chat.isGlobal || chat.users.includes(userId));
}

function canUseChat(database, chat, userId) {
  const user = findUser(database, userId);
  return canAccess(chat, userId) && (user?.approved !== false || chat.isOnboarding === true);
}

export const sendMessage = async (req, res) => {
  const { chatId, message, expiresInMinutes, scheduledFor } = req.body;
  if (!chatId || !message?.trim()) {
    return res.status(400).json({ message: 'A chat and message are required' });
  }

  try {
    const savedMessage = await updateDatabase((database) => {
      const chat = database.chats.find((item) => item._id === chatId);
      if (!canUseChat(database, chat, req.rootUserId)) return null;
      const now = new Date().toISOString();
      const scheduledTime = scheduledFor ? new Date(scheduledFor) : null;
      if (scheduledTime && Number.isNaN(scheduledTime.getTime())) return 'invalidSchedule';
      if (scheduledTime && scheduledTime.getTime() <= Date.now() + 60_000) return 'invalidSchedule';
      const expiry = Number(expiresInMinutes);
      const isScheduled = Boolean(scheduledTime);
      const newMessage = {
        _id: createId(),
        sender: req.rootUserId,
        message: message.trim(),
        chatId,
        createdAt: now,
        updatedAt: now,
        deliveredAt: isScheduled ? null : now,
        scheduledFor: isScheduled ? scheduledTime.toISOString() : null,
        expiresInMinutes: Number.isFinite(expiry) && expiry > 0 ? expiry : null,
        expiresAt: !isScheduled && Number.isFinite(expiry) && expiry > 0
          ? new Date(Date.now() + expiry * 60_000).toISOString()
          : null,
      };
      database.messages.push(newMessage);
      if (!isScheduled) chat.latestMessage = newMessage._id;
      chat.updatedAt = now;
      return expandMessage(database, newMessage);
    });
    if (savedMessage === 'invalidSchedule') {
      return res.status(400).json({ message: 'Choose a future time at least one minute from now.' });
    }
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
  if (!canUseChat(database, chat, req.rootUserId)) return res.status(404).json({ message: 'Chat not found' });
  const now = Date.now();
  const messages = database.messages
    .filter((message) => message.chatId === chatId && (message.deliveredAt || message.sender === req.rootUserId))
    .filter((message) => !message.expiresAt || new Date(message.expiresAt).getTime() > now)
    .sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt))
    .map((message) => expandMessage(database, message));
  return res.status(200).json(messages);
};

export const createPoll = async (req, res) => {
  const { chatId, question, options } = req.body;
  const cleanedOptions = Array.isArray(options) ? options.map((option) => option?.trim()).filter(Boolean) : [];
  if (!chatId || !question?.trim() || cleanedOptions.length < 2) {
    return res.status(400).json({ message: 'A poll needs a question and at least two options.' });
  }

  const savedMessage = await updateDatabase((database) => {
    const chat = database.chats.find((item) => item._id === chatId);
    if (!canUseChat(database, chat, req.rootUserId) || !chat.isGroup || chat.isGlobal) return null;
    const now = new Date().toISOString();
    const newMessage = {
      _id: createId(), sender: req.rootUserId, chatId, message: question.trim(), type: 'poll',
      poll: { question: question.trim(), options: cleanedOptions.map((text) => ({ id: createId(), text, votes: [] })) },
      createdAt: now, updatedAt: now, deliveredAt: now,
    };
    database.messages.push(newMessage);
    chat.latestMessage = newMessage._id;
    chat.updatedAt = now;
    return expandMessage(database, newMessage);
  });
  if (!savedMessage) return res.status(400).json({ message: 'Polls can only be created in a group you belong to.' });
  return res.status(201).json(savedMessage);
};

export const voteOnPoll = async (req, res) => {
  const { optionId } = req.body;
  const result = await updateDatabase((database) => {
    const message = database.messages.find((item) => item._id === req.params.messageId);
    const chat = message && database.chats.find((item) => item._id === message.chatId);
    if (!message || !canUseChat(database, chat, req.rootUserId) || message.type !== 'poll') return null;
    const choice = message.poll?.options.find((option) => option.id === optionId);
    if (!choice) return 'missingOption';
    message.poll.options.forEach((option) => {
      option.votes = (option.votes || []).filter((id) => id !== req.rootUserId);
    });
    choice.votes.push(req.rootUserId);
    message.updatedAt = new Date().toISOString();
    return expandMessage(database, message);
  });
  if (result === 'missingOption') return res.status(400).json({ message: 'Poll option not found.' });
  if (!result) return res.status(404).json({ message: 'Poll not found.' });
  return res.status(200).json(result);
};

export const togglePin = async (req, res) => {
  const result = await updateDatabase((database) => {
    publishAndPruneMessages(database);
    const message = database.messages.find((item) => item._id === req.params.messageId);
    const chat = message && database.chats.find((item) => item._id === message.chatId);
    if (!message || !canUseChat(database, chat, req.rootUserId) || !message.deliveredAt) return null;
    chat.pinnedMessageIds ||= [];
    const isPinned = chat.pinnedMessageIds.includes(message._id);
    chat.pinnedMessageIds = isPinned
      ? chat.pinnedMessageIds.filter((id) => id !== message._id)
      : [...chat.pinnedMessageIds, message._id];
    return { message: expandMessage(database, message), pinned: !isPinned };
  });
  if (!result) return res.status(404).json({ message: 'Message not found.' });
  return res.status(200).json(result);
};

export const deleteMessage = async (req, res) => {
  const removed = await updateDatabase((database) => {
    const messageIndex = database.messages.findIndex((item) => item._id === req.params.messageId);
    if (messageIndex < 0) return null;
    const [message] = database.messages.splice(messageIndex, 1);
    const chat = database.chats.find((item) => item._id === message.chatId);
    if (chat) chat.updatedAt = new Date().toISOString();
    publishAndPruneMessages(database);
    return { _id: message._id, chatId: message.chatId };
  });
  if (!removed) return res.status(404).json({ message: 'Message not found.' });
  return res.status(200).json({ message: 'Message deleted.', removed });
};
