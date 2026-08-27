import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/daily', async (req, res) => {
  const { shop_id, date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });

  const params = [date];
  let shopFilter = '';
  if (shop_id) {
    params.push(shop_id);
    shopFilter = `AND shop_id = $${params.length}`;
  }

  const income = await pool.query(
    `SELECT method, COALESCE(SUM(amount),0) AS total FROM daily_income WHERE date=$1 ${shopFilter} GROUP BY method`,
    params
  );
  const expense = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total FROM daily_expense WHERE date=$1 ${shopFilter}`,
    params
  );

  const cashIncome = Number(income.rows.find((r) => r.method === 'nakit')?.total ?? 0);
  const posIncome = Number(income.rows.find((r) => r.method === 'pos')?.total ?? 0);
  const totalExpense = Number(expense.rows[0].total);

  res.json({
    cashIncome,
    posIncome,
    income: cashIncome + posIncome,
    expense: totalExpense,
    balance: cashIncome + posIncome - totalExpense
  });
});

router.get('/monthly', async (req, res) => {
  const { shop_id, year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'year and month required' });

  const params = [year, month];
  let shopFilter = '';
  if (shop_id) {
    params.push(shop_id);
    shopFilter = `AND shop_id = $${params.length}`;
  }

  const income = await pool.query(
    `SELECT method, COALESCE(SUM(amount),0) AS total FROM daily_income
     WHERE EXTRACT(YEAR FROM date)=$1 AND EXTRACT(MONTH FROM date)=$2 ${shopFilter} GROUP BY method`,
    params
  );
  const fixedExpense = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total FROM monthly_expense WHERE year=$1 AND month=$2 ${shopFilter}`,
    params
  );
  const dailyExpense = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total FROM daily_expense WHERE EXTRACT(YEAR FROM date)=$1 AND EXTRACT(MONTH FROM date)=$2 ${shopFilter}`,
    params
  );

  const cashIncomeTotal = Number(income.rows.find((r) => r.method === 'nakit')?.total ?? 0);
  const posTotal = Number(income.rows.find((r) => r.method === 'pos')?.total ?? 0);
  const fixedExpenseTotal = Number(fixedExpense.rows[0].total);
  const dailyExpenseTotal = Number(dailyExpense.rows[0].total);

  res.json({
    posIncome: posTotal,
    cashIncome: cashIncomeTotal,
    totalIncome: posTotal + cashIncomeTotal,
    fixedExpense: fixedExpenseTotal,
    dailyExpense: dailyExpenseTotal,
    totalExpense: fixedExpenseTotal + dailyExpenseTotal,
    balance: posTotal + cashIncomeTotal - fixedExpenseTotal - dailyExpenseTotal
  });
});

export default router;
