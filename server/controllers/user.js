import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { getUserTitle, isAdminUser, isOwnerEmail } from '../middleware/user.js';
import {
  createId,
  findUser,
  getDatabase,
  noDatabaseWrite,
  updateDatabase,
  withoutPassword,
} from '../storage/store.js';

const defaultProfilePic =
  'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg';
const themeKeys = ['app', 'surface', 'sidebar', 'accent', 'outgoing', 'incoming'];
const themeSettingColorKeys = [...themeKeys, 'text', 'muted', 'outgoingText', 'incomingText', 'header', 'input', 'send', 'timestamp'];
const hexColor = /^#[0-9a-f]{6}$/i;
const themePatterns = new Set(['none', 'doodle', 'dots', 'leaves', 'waves', 'clouds', 'grid', 'stars', 'hearts', 'sun', 'snow', 'confetti']);
const themeGradients = new Set(['none', 'instagram', 'violet-pink', 'sunset', 'midnight', 'galaxy', 'aurora', 'cyber']);
const themeFonts = new Set(['system', 'serif', 'rounded', 'mono']);

function validTheme(theme) {
  return theme && typeof theme === 'object' && themeKeys.every(
    (key) => typeof theme[key] === 'string' && hexColor.test(theme[key])
  );
}

function validThemeConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false;
  if (Object.keys(config).some((key) => ![...themeSettingColorKeys, 'pattern', 'gradient', 'font', 'radius', 'brightness', 'transparency'].includes(key))) return false;
  if (themeSettingColorKeys.some((key) => config[key] !== undefined && (typeof config[key] !== 'string' || !hexColor.test(config[key])))) return false;
  if (config.pattern !== undefined && !themePatterns.has(config.pattern)) return false;
  if (config.gradient !== undefined && !themeGradients.has(config.gradient)) return false;
  if (config.font !== undefined && !themeFonts.has(config.font)) return false;
  return ![
    ['radius', 0, 32], ['brightness', 55, 130], ['transparency', 45, 100],
  ].some(([key, min, max]) => config[key] !== undefined && (!Number.isFinite(config[key]) || config[key] < min || config[key] > max));
}

function validThemeSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return false;
  if (settings.version !== 2 || typeof settings.selectedThemeId !== 'string' || settings.selectedThemeId.length > 100) return false;
  if (!Array.isArray(settings.favorites) || settings.favorites.length > 50 || settings.favorites.some((id) => typeof id !== 'string' || id.length > 100)) return false;
  if (!Array.isArray(settings.customThemes) || settings.customThemes.length > 20) return false;
  return settings.customThemes.every((theme) => theme && typeof theme === 'object' && typeof theme.id === 'string' && theme.id.length <= 100 && typeof theme.name === 'string' && theme.name.trim().length > 0 && theme.name.length <= 40 && validThemeConfig(theme.config));
}

function sanitizeThemeSettings(settings) {
  return {
    version: 2,
    selectedThemeId: settings.selectedThemeId,
    favorites: [...settings.favorites],
    customThemes: settings.customThemes.map((theme) => ({ id: theme.id, name: theme.name.trim(), config: { ...theme.config } })),
  };
}

function createToken(account) {
  return jwt.sign({ id: account._id, email: account.email }, process.env.SECRET, {
    expiresIn: '24h',
  });
}

function createOnboardingChat(database, account, now) {
  if (isOwnerEmail(account.email)) return null;
  const owner = database.users.find((user) => isOwnerEmail(user.email));
  if (!owner) return null;

  let chat = database.chats.find(
    (item) => item.isOnboarding && item.users.includes(owner._id) && item.users.includes(account._id)
  );
  if (!chat) {
    chat = {
      _id: createId(),
      chatName: 'Welcome',
      photo: defaultProfilePic,
      isGroup: false,
      isOnboarding: true,
      users: [owner._id, account._id],
      latestMessage: null,
      groupAdmin: owner._id,
      pinnedMessageIds: [],
      createdAt: now,
      updatedAt: now,
    };
    database.chats.push(chat);
  }
  return chat._id;
}

function sendToken(res, account, status = 200) {
  const token = createToken(account);
  res.cookie('userToken', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
  return res.status(status).json({ token, user: withoutPassword(account) });
}

export const register = async (req, res) => {
  const { firstname, lastname, email, password } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  if (!firstname?.trim() || !lastname?.trim() || !normalizedEmail || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  if (password.length < 7) {
    return res.status(400).json({ message: 'Password must be at least 7 characters' });
  }

  try {
    const account = await updateDatabase(async (database) => {
      if (database.settings?.registrationMode === 'invite_only' && !isOwnerEmail(normalizedEmail)) {
        return noDatabaseWrite('registrationClosed');
      }
      if (database.users.some((user) => user.email === normalizedEmail)) return null;
      const now = new Date().toISOString();
      const newUser = {
        _id: createId(),
        name: `${firstname.trim()} ${lastname.trim()}`,
        email: normalizedEmail,
        password: await bcrypt.hash(password, 12),
        bio: 'Available',
        profilePic: defaultProfilePic,
        contacts: [],
        title: 'Member',
        isAdmin: false,
        approved: isOwnerEmail(normalizedEmail),
        createdAt: now,
        updatedAt: now,
      };
      database.users.push(newUser);
      if (!newUser.approved) createOnboardingChat(database, newUser, now);
      return newUser;
    });
    if (account === 'registrationClosed') return res.status(403).json({ message: 'Registration is currently invite only.' });
    if (!account) {
      return res.status(409).json({ message: 'An account already exists for this email' });
    }
    return sendToken(res, account, 201);
  } catch (error) {
    console.error('Registration failed:', error);
    return res.status(500).json({ message: 'Unable to register. Please try again.' });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const login = await updateDatabase(async (database) => {
      const now = Date.now();
      const key = `${normalizedEmail}:${req.ip || 'unknown'}`;
      database.loginAttempts = (database.loginAttempts || []).filter((attempt) => now - new Date(attempt.createdAt).getTime() < 15 * 60_000);
      const failures = database.loginAttempts.filter((attempt) => attempt.key === key && attempt.success === false);
      if (failures.length >= 5) return noDatabaseWrite({ throttled: true });
      const account = database.users.find((user) => user.email === normalizedEmail);
      if (!account || !(await bcrypt.compare(password, account.password))) {
        database.loginAttempts.push({ key, success: false, createdAt: new Date(now).toISOString() });
        return { invalid: true };
      }
      if (account.restrictions?.bannedAt) return noDatabaseWrite({ banned: true });
      account.lastActiveAt = new Date(now).toISOString();
      database.loginAttempts = database.loginAttempts.filter((attempt) => attempt.key !== key);
      return { account };
    });
    if (login.throttled) return res.status(429).json({ message: 'Too many sign-in attempts. Please try again in 15 minutes.' });
    if (login.banned) return res.status(403).json({ message: 'This account is unavailable.' });
    if (login.invalid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    return sendToken(res, login.account);
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ message: 'Unable to log in. Please try again.' });
  }
};

export const validUser = async (req, res) => {
  const result = await updateDatabase((database) => {
    const storedAccount = findUser(database, req.rootUserId);
    if (!storedAccount) return null;
    if (isOwnerEmail(storedAccount.email)) {
      storedAccount.title = 'Owner';
      storedAccount.isAdmin = true;
    } else if (!storedAccount.title) {
      storedAccount.title = 'Member';
    }
    storedAccount.lastActiveAt = new Date().toISOString();
    const onboardingChatId = storedAccount.approved === false
      ? createOnboardingChat(database, storedAccount, new Date().toISOString())
      : null;
    return { account: storedAccount, onboardingChatId };
  });
  if (!result) return res.status(401).json({ error: 'Invalid token' });
  const { account, onboardingChatId } = result;
  return res.status(200).json({
    user: {
      ...withoutPassword(account),
      title: getUserTitle(account),
      isAdmin: isAdminUser(account),
      isOwner: isOwnerEmail(account.email),
      approved: account.approved !== false,
      onboardingChatId,
    },
    token: req.token,
  });
};

export const googleAuth = async (req, res) => {
  try {
    const { tokenId } = req.body;
    if (!tokenId || !process.env.CLIENT_ID) {
      return res.status(400).json({ message: 'Google sign-in is not configured' });
    }
    const client = new OAuth2Client(process.env.CLIENT_ID);
    const verification = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.CLIENT_ID,
    });
    const { email_verified, email, name, picture } = verification.getPayload();
    if (!email_verified || !email) {
      return res.status(401).json({ message: 'Google email is not verified' });
    }

    const normalizedEmail = email.toLowerCase();
    const account = await updateDatabase(async (database) => {
      const existing = database.users.find((user) => user.email === normalizedEmail);
      if (existing) return existing;
      if (database.settings?.registrationMode === 'invite_only' && !isOwnerEmail(normalizedEmail)) {
        return noDatabaseWrite('registrationClosed');
      }
      const now = new Date().toISOString();
      const newUser = {
        _id: createId(),
        name: name || normalizedEmail,
        email: normalizedEmail,
        password: await bcrypt.hash(createId(), 12),
        bio: 'Available',
        profilePic: picture || defaultProfilePic,
        contacts: [],
        title: 'Member',
        isAdmin: false,
        approved: isOwnerEmail(normalizedEmail),
        createdAt: now,
        updatedAt: now,
      };
      database.users.push(newUser);
      if (!newUser.approved) createOnboardingChat(database, newUser, now);
      return newUser;
    });
    if (account === 'registrationClosed') return res.status(403).json({ message: 'Registration is currently invite only.' });
    return sendToken(res, account);
  } catch (error) {
    console.error('Google sign-in failed:', error.message);
    return res.status(401).json({ message: 'Unable to verify Google sign-in' });
  }
};

export const logout = (req, res) => res.status(204).end();

export const searchUsers = async (req, res) => {
  const query = req.query.search?.trim().toLowerCase() || '';
  const database = await getDatabase();
  const matches = database.users.filter(
    (account) =>
      account._id !== req.rootUserId &&
      (!query ||
        account.name.toLowerCase().includes(query) ||
        account.email.toLowerCase().includes(query))
  );
  return res.status(200).json(matches.map((account) => {
    const { email, ...publicAccount } = withoutPassword(account);
    return publicAccount;
  }));
};

export const getUserById = async (req, res) => {
  const database = await getDatabase();
  const account = findUser(database, req.params.id);
  if (!account) return res.status(404).json({ message: 'User not found' });
  return res.status(200).json(withoutPassword(account));
};

export const toggleUserBlock = async (req, res) => {
  if (req.params.id === req.rootUserId) return res.status(400).json({ message: 'You cannot block yourself.' });
  const result = await updateDatabase((database) => {
    const target = findUser(database, req.params.id);
    const account = findUser(database, req.rootUserId);
    if (!target || !account) return null;
    account.blockedUserIds ||= [];
    const blocked = account.blockedUserIds.includes(target._id);
    account.blockedUserIds = blocked ? account.blockedUserIds.filter((id) => id !== target._id) : [...account.blockedUserIds, target._id];
    account.updatedAt = new Date().toISOString();
    return { blocked: !blocked, user: withoutPassword(account) };
  });
  if (!result) return res.status(404).json({ message: 'User not found.' });
  return res.status(200).json(result);
};

export const updateInfo = async (req, res) => {
  if (req.params.id !== req.rootUserId) {
    return res.status(403).json({ message: 'You can only update your own profile' });
  }
  const { bio, name, theme, themeSettings } = req.body;
  if (theme !== undefined && !validTheme(theme)) {
    return res.status(400).json({ message: 'Choose valid six-digit hex colors for every theme color.' });
  }
  if (themeSettings !== undefined && !validThemeSettings(themeSettings)) {
    return res.status(400).json({ message: 'Choose valid saved theme settings.' });
  }
  const account = await updateDatabase((database) => {
    const storedAccount = findUser(database, req.params.id);
    if (!storedAccount) return null;
    if (typeof name === 'string' && name.trim()) storedAccount.name = name.trim();
    if (typeof bio === 'string') storedAccount.bio = bio.trim();
    if (theme !== undefined) {
      storedAccount.theme = Object.fromEntries(themeKeys.map((key) => [key, theme[key]]));
    }
    if (themeSettings !== undefined) {
      storedAccount.themeSettings = sanitizeThemeSettings(themeSettings);
    }
    storedAccount.updatedAt = new Date().toISOString();
    return storedAccount;
  });
  if (!account) return res.status(404).json({ message: 'User not found' });
  return res.status(200).json(withoutPassword(account));
};
