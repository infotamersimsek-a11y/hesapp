import { pool } from './db.js';

export async function adjustVendorDebt(vendorName, delta) {
  if (!vendorName || !delta) return;
  const { rows } = await pool.query(
    `INSERT INTO vendor_debt (vendor_name, debt_amount) VALUES ($1, $2)
     ON CONFLICT (vendor_name) DO UPDATE SET debt_amount = vendor_debt.debt_amount + $2
     RETURNING debt_amount`,
    [vendorName, delta]
  );
  await pool.query(
    'INSERT INTO vendor_debt_log (vendor_name, amount) VALUES ($1, $2)',
    [vendorName, rows[0].debt_amount]
  );
}
