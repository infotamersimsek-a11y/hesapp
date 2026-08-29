import { Router } from 'express';
import { pool } from '../db.js';
import { adjustCardDebt } from '../cardDebt.js';

const router = Router();

router.get('/', async (req, res) => {
  const { shop_id, year } = req.query;
  const conditions = [];
  const params = [];

  if (shop_id) {
    params.push(shop_id);
    conditions.push(`shop_id = $${params.length}`);
  }
  if (year) {
    params.push(year);
    conditions.push(`year = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM monthly_expense ${where} ORDER BY year DESC, month DESC, id DESC`,
    params
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { shop_id, year, month, vendor_name, category, amount, note, credit_card_id } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO monthly_expense (shop_id, year, month, vendor_name, category, amount, note, credit_card_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [shop_id, year, month, vendor_name, category ?? null, amount, note ?? null, credit_card_id || null]
  );
  if (credit_card_id) await adjustCardDebt(credit_card_id, Number(amount));
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { shop_id, year, month, vendor_name, category, amount, note, credit_card_id } = req.body;
  const prev = await pool.query('SELECT amount, credit_card_id FROM monthly_expense WHERE id=$1', [req.params.id]);
  const { rows } = await pool.query(
    `UPDATE monthly_expense SET shop_id=$1, year=$2, month=$3, vendor_name=$4, category=$5, amount=$6, note=$7, credit_card_id=$8
     WHERE id=$9 RETURNING *`,
    [shop_id, year, month, vendor_name, category ?? null, amount, note ?? null, credit_card_id || null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  if (prev.rows[0]?.credit_card_id) await adjustCardDebt(prev.rows[0].credit_card_id, -Number(prev.rows[0].amount));
  if (credit_card_id) await adjustCardDebt(credit_card_id, Number(amount));
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const prev = await pool.query('SELECT amount, credit_card_id FROM monthly_expense WHERE id=$1', [req.params.id]);
  await pool.query('DELETE FROM monthly_expense WHERE id=$1', [req.params.id]);
  if (prev.rows[0]?.credit_card_id) await adjustCardDebt(prev.rows[0].credit_card_id, -Number(prev.rows[0].amount));
  res.status(204).end();
});

export default router;
