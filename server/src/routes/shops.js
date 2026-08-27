import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM shops ORDER BY id');
  res.json(rows);
});

export default router;
