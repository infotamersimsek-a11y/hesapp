import { Router } from 'express';
import { resolveLogin, signToken } from '../auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  const defaultShop = resolveLogin(password);
  if (!defaultShop) {
    return res.status(401).json({ error: 'Şifre yanlış' });
  }
  res.json({ token: signToken(defaultShop), defaultShop });
});

export default router;
