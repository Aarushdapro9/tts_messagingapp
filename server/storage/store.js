import { randomUUID } from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { get as getBlob, put as putBlob } from '@vercel/blob';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDataFile = path.join(moduleDirectory, '..', 'data', 'database.json');
const dataFile = process.env.DATA_FILE || defaultDataFile;
const blobPath = 'chat/database.json';
const usesBlobStore = Boolean(
  process.env.BLOB_READ_WRITE_TOKEN ||
    (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
);
const emptyDatabase = () => ({ users: [], chats: [], messages: [], alerts: [] });

let writeQueue = Promise.resolve();

async function readDatabase() {
  if (usesBlobStore) {
    const result = await getBlob(blobPath, { access: 'private', useCache: false });
    if (!result || result.statusCode === 304 || !result.stream) return emptyDatabase();
    const parsed = JSON.parse(await new Response(result.stream).text());
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      chats: Array.isArray(parsed.chats) ? parsed.chats : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
    };
  }

  try {
    const raw = await readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      chats: Array.isArray(parsed.chats) ? parsed.chats : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
    };
  } catch (error) {
    if (error.code === 'ENOENT') return emptyDatabase();
    throw error;
  }
}

async function writeDatabase(database) {
  if (usesBlobStore) {
    await putBlob(blobPath, JSON.stringify(database), {
      access: 'private',
      allowOverwrite: true,
      contentType: 'application/json',
    });
    return;
  }

  await mkdir(path.dirname(dataFile), { recursive: true });
  const temporaryFile = `${dataFile}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
  await rename(temporaryFile, dataFile);
}

export async function initializeStore() {
  const database = await readDatabase();
  if (!usesBlobStore) await writeDatabase(database);
  console.log(
    usesBlobStore ? 'Vercel Blob database ready' : `File database ready at ${dataFile}`
  );
}

export async function getDatabase() {
  await writeQueue;
  return readDatabase();
}

export async function updateDatabase(mutator) {
  const task = writeQueue.then(async () => {
    const database = await readDatabase();
    const result = await mutator(database);
    await writeDatabase(database);
    return result;
  });

  writeQueue = task.catch(() => undefined);
  return task;
}

export function createId() {
  return randomUUID();
}

export function withoutPassword(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

export function findUser(database, id) {
  return database.users.find((user) => user._id === id) || null;
}

export function expandChat(database, chat) {
  if (!chat) return null;
  const latestMessage = database.messages.find((message) => message._id === chat.latestMessage);
  return {
    ...chat,
    users: (chat.isGlobal ? database.users.map((user) => user._id) : chat.users)
      .map((id) => withoutPassword(findUser(database, id)))
      .filter(Boolean),
    groupAdmin: withoutPassword(findUser(database, chat.groupAdmin)),
    latestMessage: latestMessage ? expandMessage(database, latestMessage) : null,
  };
}

export function expandMessage(database, message) {
  if (!message) return null;
  return {
    ...message,
    pinned: Boolean(database.chats.find((chat) => chat._id === message.chatId)?.pinnedMessageIds?.includes(message._id)),
    sender: withoutPassword(findUser(database, message.sender)),
    chatId: expandChatWithoutLatestMessage(database, message.chatId),
  };
}

export function publishAndPruneMessages(database, now = new Date()) {
  const nowTime = now.getTime();
  for (const message of database.messages) {
    if (!message.deliveredAt && message.scheduledFor && new Date(message.scheduledFor).getTime() <= nowTime) {
      message.deliveredAt = now.toISOString();
      if (message.expiresInMinutes) {
        message.expiresAt = new Date(nowTime + message.expiresInMinutes * 60_000).toISOString();
      }
    }
  }

  const pinnedMessageIds = new Set(database.chats.flatMap((chat) => chat.pinnedMessageIds || []));
  database.messages = database.messages.filter(
    (message) => pinnedMessageIds.has(message._id) || !message.expiresAt || new Date(message.expiresAt).getTime() > nowTime
  );

  for (const chat of database.chats) {
    const visibleMessages = database.messages
      .filter((message) => message.chatId === chat._id && message.deliveredAt)
      .sort((first, second) => new Date(second.deliveredAt) - new Date(first.deliveredAt));
    chat.latestMessage = visibleMessages[0]?._id || null;
    chat.pinnedMessageIds = (chat.pinnedMessageIds || []).filter((id) =>
      database.messages.some((message) => message._id === id)
    );
  }
}

function expandChatWithoutLatestMessage(database, chatId) {
  const chat = database.chats.find((item) => item._id === chatId);
  if (!chat) return null;
  return {
    ...chat,
    users: (chat.isGlobal ? database.users.map((user) => user._id) : chat.users)
      .map((id) => withoutPassword(findUser(database, id)))
      .filter(Boolean),
    groupAdmin: withoutPassword(findUser(database, chat.groupAdmin)),
    latestMessage: chat.latestMessage || null,
  };
}
