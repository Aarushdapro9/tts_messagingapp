import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import {
  createId,
  findUser,
  getDatabase,
  updateDatabase,
  withoutPassword,
} from '../storage/store.js';

const defaultProfilePic =
  'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg';

function createToken(account) {
  return jwt.sign({ id: account._id, email: account.email }, process.env.SECRET, {
    expiresIn: '24h',
  });
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
        createdAt: now,
        updatedAt: now,
      };
      database.users.push(newUser);
      return newUser;
    });
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
    const database = await getDatabase();
    const account = database.users.find((user) => user.email === normalizedEmail);
    if (!account || !(await bcrypt.compare(password, account.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    return sendToken(res, account);
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ message: 'Unable to log in. Please try again.' });
  }
};

export const validUser = async (req, res) =>
  res.status(200).json({ user: withoutPassword(req.rootUser), token: req.token });

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
      const now = new Date().toISOString();
      const newUser = {
        _id: createId(),
        name: name || normalizedEmail,
        email: normalizedEmail,
        password: await bcrypt.hash(createId(), 12),
        bio: 'Available',
        profilePic: picture || defaultProfilePic,
        contacts: [],
        createdAt: now,
        updatedAt: now,
      };
      database.users.push(newUser);
      return newUser;
    });
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
  return res.status(200).json(matches.map(withoutPassword));
};

export const getUserById = async (req, res) => {
  const database = await getDatabase();
  const account = findUser(database, req.params.id);
  if (!account) return res.status(404).json({ message: 'User not found' });
  return res.status(200).json(withoutPassword(account));
};

export const updateInfo = async (req, res) => {
  if (req.params.id !== req.rootUserId) {
    return res.status(403).json({ message: 'You can only update your own profile' });
  }
  const { bio, name } = req.body;
  const account = await updateDatabase((database) => {
    const storedAccount = findUser(database, req.params.id);
    if (!storedAccount) return null;
    if (typeof name === 'string' && name.trim()) storedAccount.name = name.trim();
    if (typeof bio === 'string') storedAccount.bio = bio.trim();
    storedAccount.updatedAt = new Date().toISOString();
    return storedAccount;
  });
  if (!account) return res.status(404).json({ message: 'User not found' });
  return res.status(200).json(withoutPassword(account));
};
