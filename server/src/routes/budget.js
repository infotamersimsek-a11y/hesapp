import { Router } from 'express';
import { pool } from '../db.js';
import { assertDateAllowed } from '../dateGuard.js';

const router = Router();

router.get('/', async (req, res) => {
  const { shop_id } = req.query;
  if (!shop_id) return res.status(400).json({ error: 'shop_id required' });

  const balanceRes = await pool.query(
    'SELECT COALESCE(SUM(amount),0) AS balance FROM budget_transaction WHERE shop_id=$1',
    [shop_id]
  );
  const txRes = await pool.query(
    `SELECT id, amount, note, to_char(date, 'YYYY-MM-DD') AS date, daily_expense_id
     FROM budget_transaction WHERE shop_id=$1 ORDER BY date DESC, id DESC LIMIT 30`,
    [shop_id]
  );
  res.json({
    balance: Number(balanceRes.rows[0].balance),
    transactions: txRes.rows.map((r) => ({ ...r, amount: Number(r.amount) })),
  });
});

router.post('/topup', async (req, res) => {
  const { shop_id, amount, note, date, admin_password } = req.body;
  if (!shop_id || !amount) return res.status(400).json({ error: 'shop_id and amount required' });
  assertDateAllowed(date, admin_password);
  const { rows } = await pool.query(
    `INSERT INTO budget_transaction (shop_id, amount, note, date) VALUES ($1, $2, $3, $4) RETURNING *`,
    [shop_id, amount, note ?? null, date]
  );
  res.status(201).json(rows[0]);
});

export default router;
