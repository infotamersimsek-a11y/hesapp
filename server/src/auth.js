import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export function signToken() {
  return jwt.sign({ auth: true }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

export function checkPassword(password) {
  const expected = Buffer.from(process.env.APP_PASSWORD || '');
  const given = Buffer.from(password || '');
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Giriş gerekli' });

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Oturum geçersiz, tekrar giriş yap' });
  }
}
