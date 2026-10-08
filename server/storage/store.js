import { randomUUID } from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDataFile = path.join(moduleDirectory, '..', 'data', 'database.json');
const dataFile = process.env.DATA_FILE || defaultDataFile;
const emptyDatabase = () => ({ users: [], chats: [], messages: [] });

let writeQueue = Promise.resolve();

async function readDatabase() {
  try {
    const raw = await readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      chats: Array.isArray(parsed.chats) ? parsed.chats : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch (error) {
    if (error.code === 'ENOENT') return emptyDatabase();
    throw error;
  }
}

async function writeDatabase(database) {
  await mkdir(path.dirname(dataFile), { recursive: true });
  const temporaryFile = `${dataFile}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
  await rename(temporaryFile, dataFile);
}

export async function initializeStore() {
  const database = await readDatabase();
  await writeDatabase(database);
  console.log(`File database ready at ${dataFile}`);
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
  const latestMessage = database.messages.find(
    (message) => message._id === chat.latestMessage
  );
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
    sender: withoutPassword(findUser(database, message.sender)),
    chatId: expandChatWithoutLatestMessage(database, message.chatId),
  };
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
