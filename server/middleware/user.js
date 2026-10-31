import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { getDatabase } from '../storage/store.js';
import { accountStatus } from '../services/moderation.js';

export const Auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : header;
    if (!token) return res.status(401).json({ error: 'Authentication is required' });

    let email;
    let userId;
    try {
      const payload = jwt.verify(token, process.env.SECRET);
      email = payload.email;
      userId = payload.id;
    } catch {
      if (!process.env.CLIENT_ID) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      const client = new OAuth2Client(process.env.CLIENT_ID);
      const verification = await client.verifyIdToken({
        idToken: token,
        audience: process.env.CLIENT_ID,
      });
      const payload = verification.getPayload();
      if (!payload.email_verified || !payload.email) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      email = payload.email.toLowerCase();
    }

    const database = await getDatabase();
    const rootUser = database.users.find(
      (user) => (userId && user._id === userId) || user.email === email
    );
    if (!rootUser) return res.status(401).json({ error: 'Invalid token' });
    if (accountStatus(rootUser) === 'Banned') return res.status(403).json({ error: 'This account is unavailable.' });
    if (database.settings?.maintenanceMode && !isOwnerEmail(rootUser.email)) {
      return res.status(503).json({ error: 'The app is temporarily in maintenance mode.' });
    }
    req.rootUser = rootUser;
    req.rootUserId = rootUser._id;
    req.token = token;
    return next();
  } catch (error) {
    console.error('Authentication failed:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

function configuredEmails(variableName) {
  return (process.env[variableName] || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export const isAdminEmail = (email) => {
  const allowedEmails = configuredEmails('ADMIN_EMAILS');

  return allowedEmails.includes(email?.toLowerCase());
};

export const isOwnerEmail = (email) => {
  const ownerEmail = configuredEmails('OWNER_EMAIL')[0] || configuredEmails('ADMIN_EMAILS')[0];
  return Boolean(ownerEmail && ownerEmail === email?.toLowerCase());
};

export const isAdminUser = (user) =>
  Boolean(user && (isOwnerEmail(user.email) || isAdminEmail(user.email) || user.isAdmin));

export const getUserTitle = (user) => {
  if (isOwnerEmail(user?.email)) return 'Owner';
  const customTitle = typeof user?.title === 'string' ? user.title.trim() : '';
  if (customTitle) return customTitle;
  return isAdminUser(user) ? 'Administrator' : 'Member';
};

export const Admin = (req, res, next) => {
  if (!isAdminUser(req.rootUser)) {
    return res.status(403).json({ error: 'Administrator access is required' });
  }
  return next();
};

export const Owner = (req, res, next) => {
  if (!isOwnerEmail(req.rootUser?.email)) {
    return res.status(403).json({ error: 'Owner access is required' });
  }
  return next();
};
