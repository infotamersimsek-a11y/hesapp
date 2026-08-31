import jwt from 'jsonwebtoken';
import crypto from 'crypto';

function passwordsMatch(a, b) {
  const expected = Buffer.from(a || '');
  const given = Buffer.from(b || '');
  if (expected.length === 0 || expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}

export function resolveLogin(password) {
  const passwordShops = [
    { password: process.env.APP_PASSWORD, defaultShop: 'Hacıoğulları' },
    { password: process.env.APP_PASSWORD_2, defaultShop: 'Çıtır Tatlı' },
  ];
  const match = passwordShops.find((p) => passwordsMatch(p.password, password));
  return match ? match.defaultShop : null;
}

export function signToken(defaultShop) {
  return jwt.sign({ auth: true, defaultShop }, process.env.JWT_SECRET, { expiresIn: '30d' });
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
