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
    `SELECT * FROM daily_expense ${where} ORDER BY date DESC, id DESC`,
    params
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { shop_id, date, category, amount, note, credit_card_id, admin_password } = req.body;
  assertDateAllowed(date, admin_password);
  const { rows } = await pool.query(
    `INSERT INTO daily_expense (shop_id, date, category, amount, note, credit_card_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [shop_id, date, category, amount, note ?? null, credit_card_id || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { shop_id, date, category, amount, note, credit_card_id, admin_password } = req.body;
  assertDateAllowed(date, admin_password);
  const { rows } = await pool.query(
    `UPDATE daily_expense SET shop_id=$1, date=$2, category=$3, amount=$4, note=$5, credit_card_id=$6 WHERE id=$7 RETURNING *`,
    [shop_id, date, category, amount, note ?? null, credit_card_id || null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM daily_expense WHERE id=$1 AND date=$2 RETURNING id',
    [req.params.id, todayStr()]
  );
  if (!rows.length) {
    return res.status(403).json({ error: 'Geçmiş tarihli kayıt silinemez, sadece yeni ekleme yapılabilir' });
  }
  res.status(204).end();
});

export default router;
