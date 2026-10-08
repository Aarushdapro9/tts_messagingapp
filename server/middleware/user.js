import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { getDatabase } from '../storage/store.js';

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
    req.rootUser = rootUser;
    req.rootUserId = rootUser._id;
    req.token = token;
    return next();
  } catch (error) {
    console.error('Authentication failed:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};
