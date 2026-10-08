import {
  createId,
  expandChat,
  findUser,
  updateDatabase,
} from '../storage/store.js';

const defaultGroupPhoto = 'https://cdn-icons-png.flaticon.com/512/9790/9790561.png';

function canAccess(chat, userId) {
  return chat && (chat.isGlobal || chat.users.includes(userId));
}

export const accessGlobalChat = async (_req, res) => {
  const globalChat = await updateDatabase((database) => {
    let chat = database.chats.find((item) => item.isGlobal);
    if (!chat) {
      const now = new Date().toISOString();
      chat = {
        _id: createId(),
        chatName: 'Global Chat',
        photo: defaultGroupPhoto,
        isGroup: false,
        isGlobal: true,
        users: [],
        latestMessage: null,
        groupAdmin: null,
        createdAt: now,
        updatedAt: now,
      };
      database.chats.push(chat);
    }
    return expandChat(database, chat);
  });
  return res.status(200).json(globalChat);
};

export const accessChats = async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "Provide user's ID" });
  if (userId === req.rootUserId) {
    return res.status(400).json({ message: 'You cannot create a chat with yourself' });
  }

  const chat = await updateDatabase((database) => {
    if (!findUser(database, userId)) return null;
    let existing = database.chats.find(
      (item) =>
        !item.isGroup &&
        !item.isGlobal &&
        item.users.length === 2 &&
        item.users.includes(userId) &&
        item.users.includes(req.rootUserId)
    );
    if (!existing) {
      const now = new Date().toISOString();
      existing = {
        _id: createId(),
        chatName: 'sender',
        photo: defaultGroupPhoto,
        isGroup: false,
        users: [req.rootUserId, userId],
        latestMessage: null,
        groupAdmin: null,
        createdAt: now,
        updatedAt: now,
      };
      database.chats.push(existing);
    }
    return expandChat(database, existing);
  });
  if (!chat) return res.status(404).json({ message: 'User not found' });
  return res.status(200).json(chat);
};

export const fetchAllChats = async (req, res) => {
  const chats = await updateDatabase((database) => {
    if (!database.chats.some((chat) => chat.isGlobal)) {
      const now = new Date().toISOString();
      database.chats.push({
        _id: createId(),
        chatName: 'Global Chat',
        photo: defaultGroupPhoto,
        isGroup: false,
        isGlobal: true,
        users: [],
        latestMessage: null,
        groupAdmin: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    return database.chats
      .filter((chat) => chat.isGlobal || chat.users.includes(req.rootUserId))
      .sort((first, second) => {
        if (first.isGlobal) return -1;
        if (second.isGlobal) return 1;
        return new Date(second.updatedAt) - new Date(first.updatedAt);
      })
      .map((chat) => expandChat(database, chat));
  });
  return res.status(200).json(chats);
};

export const creatGroup = async (req, res) => {
  const { chatName, users } = req.body;
  if (!chatName?.trim() || !users) {
    return res.status(400).json({ message: 'Please fill the fields' });
  }
  let selectedUsers;
  try {
    selectedUsers = Array.isArray(users) ? users : JSON.parse(users);
  } catch {
    return res.status(400).json({ message: 'Users must be a valid list' });
  }
  const uniqueUserIds = [...new Set([...selectedUsers, req.rootUserId])];
  if (uniqueUserIds.length < 3) {
    return res.status(400).json({ message: 'A group needs at least three members' });
  }

  const chat = await updateDatabase((database) => {
    if (uniqueUserIds.some((id) => !findUser(database, id))) return null;
    const now = new Date().toISOString();
    const newChat = {
      _id: createId(),
      chatName: chatName.trim(),
      photo: defaultGroupPhoto,
      isGroup: true,
      users: uniqueUserIds,
      latestMessage: null,
      groupAdmin: req.rootUserId,
      createdAt: now,
      updatedAt: now,
    };
    database.chats.push(newChat);
    return expandChat(database, newChat);
  });
  if (!chat) return res.status(404).json({ message: 'One or more users no longer exist' });
  return res.status(201).json(chat);
};

export const renameGroup = async (req, res) => {
  const { chatId, chatName } = req.body;
  if (!chatId || !chatName?.trim()) {
    return res.status(400).json({ message: 'Provide a chat ID and chat name' });
  }
  const chat = await updateDatabase((database) => {
    const storedChat = database.chats.find((item) => item._id === chatId);
    if (!canAccess(storedChat, req.rootUserId) || !storedChat.isGroup || storedChat.isGlobal) return null;
    storedChat.chatName = chatName.trim();
    storedChat.updatedAt = new Date().toISOString();
    return expandChat(database, storedChat);
  });
  if (!chat) return res.status(404).json({ message: 'Group not found' });
  return res.status(200).json(chat);
};

export const addToGroup = async (req, res) => {
  const { userId, chatId } = req.body;
  const chat = await updateDatabase((database) => {
    const storedChat = database.chats.find((item) => item._id === chatId);
    if (!canAccess(storedChat, req.rootUserId) || !storedChat.isGroup || storedChat.isGlobal || !findUser(database, userId)) {
      return null;
    }
    if (storedChat.users.includes(userId)) return 'exists';
    storedChat.users.push(userId);
    storedChat.updatedAt = new Date().toISOString();
    return expandChat(database, storedChat);
  });
  if (chat === 'exists') return res.status(409).json({ message: 'User already exists in this group' });
  if (!chat) return res.status(404).json({ message: 'Group or user not found' });
  return res.status(200).json(chat);
};

export const removeFromGroup = async (req, res) => {
  const { userId, chatId } = req.body;
  const chat = await updateDatabase((database) => {
    const storedChat = database.chats.find((item) => item._id === chatId);
    if (!canAccess(storedChat, req.rootUserId) || !storedChat.isGroup || storedChat.isGlobal) return null;
    if (!storedChat.users.includes(userId)) return 'missing';
    if (userId === storedChat.groupAdmin && storedChat.users.length > 1) {
      storedChat.groupAdmin = storedChat.users.find((id) => id !== userId);
    }
    storedChat.users = storedChat.users.filter((id) => id !== userId);
    storedChat.updatedAt = new Date().toISOString();
    return expandChat(database, storedChat);
  });
  if (chat === 'missing') return res.status(409).json({ message: 'User does not exist in this group' });
  if (!chat) return res.status(404).json({ message: 'Group not found' });
  return res.status(200).json(chat);
};

export const removeContact = async (_req, res) =>
  res.status(501).json({ message: 'Not implemented' });
