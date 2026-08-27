import { Router } from 'express';
import { checkPassword, signToken } from '../auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!checkPassword(password)) {
    return res.status(401).json({ error: 'Şifre yanlış' });
  }
  res.json({ token: signToken() });
});

export default router;
