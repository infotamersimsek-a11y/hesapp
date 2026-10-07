import { Router } from 'express';
import { pool } from '../db.js';
import { todayStr, assertDateAllowed } from '../dateGuard.js';
import { isTrustedAdmin } from '../auth.js';

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
    `SELECT id, shop_id, to_char(date, 'YYYY-MM-DD') AS date, category, amount_kg, note FROM waste_log ${where} ORDER BY date DESC, id DESC`,
    params
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { shop_id, date, category, amount_kg, note, admin_password } = req.body;
  assertDateAllowed(date, admin_password, isTrustedAdmin(req));
  const { rows } = await pool.query(
    `INSERT INTO waste_log (shop_id, date, category, amount_kg, note) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, shop_id, to_char(date, 'YYYY-MM-DD') AS date, category, amount_kg, note`,
    [shop_id, date, category, amount_kg, note ?? null]
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM waste_log WHERE id=$1 AND date=$2 RETURNING id',
    [req.params.id, todayStr()]
  );
  if (!rows.length) {
    return res.status(403).json({ error: 'Geçmiş tarihli kayıt silinemez, sadece bugünün kaydı silinebilir' });
  }
  res.status(204).end();
});

export default router;
