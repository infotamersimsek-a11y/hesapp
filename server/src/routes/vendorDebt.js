import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM vendor_debt ORDER BY debt_amount DESC`
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

router.get('/debt-paid', async (req, res) => {
  const { year, month, since } = req.query;
  let periodStart, periodEnd;
  if (since) {
    periodStart = since;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    periodEnd = toDateStr(tomorrow);
  } else {
    if (!year || !month) return res.status(400).json({ error: 'year and month, or since, required' });
    periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    periodEnd = Number(month) === 12 ? `${Number(year) + 1}-01-01` : `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`;
  }

  const vendorsRes = await pool.query('SELECT vendor_name, debt_amount FROM vendor_debt ORDER BY vendor_name');

  const baselineRes = await pool.query(
    `SELECT DISTINCT ON (vendor_name) vendor_name, amount, to_char(recorded_at, 'YYYY-MM-DD') AS recorded_date
     FROM vendor_debt_log
     WHERE recorded_at < $1
     ORDER BY vendor_name, recorded_at DESC`,
    [periodStart]
  );
  const baselineMap = new Map(baselineRes.rows.map((r) => [r.vendor_name, { amount: Number(r.amount), date: r.recorded_date, isMonthStart: true }]));

  const fallbackRes = await pool.query(
    `SELECT DISTINCT ON (vendor_name) vendor_name, amount, to_char(recorded_at, 'YYYY-MM-DD') AS recorded_date
     FROM vendor_debt_log
     WHERE recorded_at >= $1 AND recorded_at < $2
     ORDER BY vendor_name, recorded_at ASC`,
    [periodStart, periodEnd]
  );
  for (const r of fallbackRes.rows) {
    if (!baselineMap.has(r.vendor_name)) {
      baselineMap.set(r.vendor_name, { amount: Number(r.amount), date: r.recorded_date, isMonthStart: false });
    }
  }

  const byVendor = vendorsRes.rows
    .filter((v) => baselineMap.has(v.vendor_name))
    .map((v) => {
      const currentDebt = Number(v.debt_amount);
      const baseline = baselineMap.get(v.vendor_name);
      return {
        vendor_name: v.vendor_name,
        startDebt: baseline.amount,
        startDate: baseline.date,
        isMonthStart: baseline.isMonthStart,
        currentDebt,
        paid: Number((baseline.amount - currentDebt).toFixed(2)),
      };
    });
  const totalPaid = Number(byVendor.reduce((s, v) => s + v.paid, 0).toFixed(2));
  res.json({ totalPaid, byVendor });
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

router.delete('/:vendor_name', async (req, res) => {
  const vendorName = decodeURIComponent(req.params.vendor_name);
  await pool.query('DELETE FROM vendor_debt WHERE vendor_name=$1', [vendorName]);
  await pool.query('DELETE FROM vendor_debt_log WHERE vendor_name=$1', [vendorName]);
  res.status(204).end();
});

export default router;
