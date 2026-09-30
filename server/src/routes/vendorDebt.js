import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM vendor_debt WHERE debt_amount <> 0 ORDER BY debt_amount DESC`
  );
  const vendorNames = rows.map((r) => r.vendor_name);
  const historyByVendor = {};
  if (vendorNames.length) {
    const hist = await pool.query(
      `SELECT vendor_name, amount, recorded_at FROM vendor_debt_log WHERE vendor_name = ANY($1) ORDER BY recorded_at DESC`,
      [vendorNames]
    );
    for (const h of hist.rows) {
      (historyByVendor[h.vendor_name] ??= []).push(h);
    }
  }
  res.json(rows.map((r) => {
    const entries = (historyByVendor[r.vendor_name] || []).slice(0, 6).map((h) => ({ amount: Number(h.amount), recorded_at: h.recorded_at }));
    const history = entries.slice(0, 5).map((e, i) => {
      const prev = entries[i + 1];
      const delta = prev ? Number((prev.amount - e.amount).toFixed(2)) : null;
      return { ...e, delta };
    });
    return { vendor_name: r.vendor_name, debt_amount: Number(r.debt_amount), history };
  }));
});

router.put('/:vendor_name', async (req, res) => {
  const { debt_amount } = req.body;
  const vendorName = decodeURIComponent(req.params.vendor_name);
  if (debt_amount === undefined || debt_amount === null) return res.status(400).json({ error: 'debt_amount required' });
  const { rows } = await pool.query(
    `INSERT INTO vendor_debt (vendor_name, debt_amount) VALUES ($1, $2)
     ON CONFLICT (vendor_name) DO UPDATE SET debt_amount = $2
     RETURNING *`,
    [vendorName, debt_amount]
  );
  await pool.query('INSERT INTO vendor_debt_log (vendor_name, amount) VALUES ($1, $2)', [vendorName, debt_amount]);
  res.json(rows[0]);
});

export default router;
