import { Router } from 'express';
import { pool } from '../db.js';
import { todayStr, assertDateAllowed } from '../dateGuard.js';

const router = Router();

router.get('/', async (req, res) => {
  const { shop_id, from, to } = req.query;
  const conditions = [];
  const params = [];

  if (shop_id) {
    params.push(shop_id);
    conditions.push(`shop_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`date <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM daily_income ${where} ORDER BY date DESC, id DESC`,
    params
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { shop_id, date, method, amount, note, admin_password } = req.body;
  assertDateAllowed(date, admin_password);
  const { rows } = await pool.query(
    `INSERT INTO daily_income (shop_id, date, method, amount, note) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [shop_id, date, method || 'nakit', amount, note ?? null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { shop_id, date, method, amount, note, admin_password } = req.body;
  assertDateAllowed(date, admin_password);
  const { rows } = await pool.query(
    `UPDATE daily_income SET shop_id=$1, date=$2, method=$3, amount=$4, note=$5 WHERE id=$6 RETURNING *`,
    [shop_id, date, method || 'nakit', amount, note ?? null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM daily_income WHERE id=$1 AND date=$2 RETURNING id',
    [req.params.id, todayStr()]
  );
  if (!rows.length) {
    return res.status(403).json({ error: 'Geçmiş tarihli kayıt silinemez, sadece yeni ekleme yapılabilir' });
  }
  res.status(204).end();
});

export default router;
