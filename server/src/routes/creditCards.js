import { Router } from 'express';
import { pool } from '../db.js';
import { CARD_PAYMENT_CATEGORY } from '../cardDebt.js';

const router = Router();

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function clampDay(year, monthIndex, day) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(day, lastDay);
}

function nextOccurrence(day, from = new Date()) {
  if (day == null) return null;
  const todayMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let year = from.getFullYear();
  let monthIndex = from.getMonth();
  let candidate = new Date(year, monthIndex, clampDay(year, monthIndex, day));

  if (candidate < todayMidnight) {
    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
    candidate = new Date(year, monthIndex, clampDay(year, monthIndex, day));
  }
  return candidate;
}

function daysUntil(date, from = new Date()) {
  if (!date) return null;
  const todayMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((date - todayMidnight) / 86400000);
}

export function withComputed(card) {
  const nextStatementDate = nextOccurrence(card.statement_day);
  const nextDueDate = nextOccurrence(card.due_day);
  const daysUntilDue = daysUntil(nextDueDate);
  const creditLimit = card.credit_limit == null ? null : Number(card.credit_limit);
  return {
    ...card,
    next_statement_date: nextStatementDate ? toDateStr(nextStatementDate) : null,
    next_due_date: nextDueDate ? toDateStr(nextDueDate) : null,
    days_until_due: daysUntilDue,
    due_soon: daysUntilDue !== null && daysUntilDue <= 3,
    available_limit: creditLimit === null ? null : Number((creditLimit - Number(card.debt_amount)).toFixed(2)),
  };
}

async function paymentHistory(cardId) {
  const { rows } = await pool.query(
    `SELECT amount, recorded_at FROM credit_card_debt_log WHERE credit_card_id=$1 ORDER BY recorded_at DESC LIMIT 6`,
    [cardId]
  );
  const entries = rows.map((r) => ({ amount: Number(r.amount), recorded_at: r.recorded_at }));
  return entries.slice(0, 5).map((e, i) => {
    const prev = entries[i + 1];
    const delta = prev ? Number((prev.amount - e.amount).toFixed(2)) : null;
    return { ...e, delta };
  });
}

async function recentCharges(cardId) {
  const since = new Date();
  since.setDate(since.getDate() - 3);
  const { rows } = await pool.query(
    `SELECT amount, category AS label, date, note FROM daily_expense WHERE credit_card_id=$1 AND date >= $2 AND category <> $3 ORDER BY date DESC, id DESC`,
    [cardId, toDateStr(since), CARD_PAYMENT_CATEGORY]
  );
  return rows.map((r) => ({ amount: Number(r.amount), label: r.label, date: r.date, note: r.note }));
}

async function reconciliationFor(cardId, debtNow) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = toDateStr(monthStart);

  const priorLog = await pool.query(
    `SELECT amount FROM credit_card_debt_log WHERE credit_card_id=$1 AND recorded_at < $2 ORDER BY recorded_at DESC LIMIT 1`,
    [cardId, monthStart]
  );
  const debtStart = priorLog.rows[0] ? Number(priorLog.rows[0].amount) : null;

  const dailyExp = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total FROM daily_expense WHERE credit_card_id=$1 AND date >= $2`,
    [cardId, monthStartStr]
  );
  const monthlyExp = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total FROM monthly_expense WHERE credit_card_id=$1 AND year=$2 AND month=$3`,
    [cardId, now.getFullYear(), now.getMonth() + 1]
  );

  const recordedExpense = Number(dailyExp.rows[0].total) + Number(monthlyExp.rows[0].total);
  const cardSpend = debtStart === null ? null : Number((debtNow - debtStart).toFixed(2));
  const discrepancy = cardSpend === null ? null : Number((cardSpend - recordedExpense).toFixed(2));

  return {
    month_start: monthStartStr,
    debt_start_of_month: debtStart,
    card_spend_estimate: cardSpend,
    recorded_expense_this_month: recordedExpense,
    discrepancy,
    flagged: discrepancy !== null && Math.abs(discrepancy) > 1,
  };
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM credit_cards ORDER BY id');
  const withCalc = await Promise.all(
    rows.map(async (card) => ({
      ...withComputed(card),
      reconciliation: await reconciliationFor(card.id, Number(card.debt_amount)),
      history: await paymentHistory(card.id),
      recent_charges: await recentCharges(card.id),
    }))
  );
  res.json(withCalc);
});

router.post('/', async (req, res) => {
  const { name, owner, type, last4, credit_limit, debt_amount, statement_day, due_day, note } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO credit_cards (name, owner, type, last4, credit_limit, debt_amount, statement_day, due_day, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [name, owner, type, last4 || null, credit_limit || null, debt_amount ?? 0, statement_day || null, due_day || null, note ?? null]
  );
  const card = rows[0];
  await pool.query(
    `INSERT INTO credit_card_debt_log (credit_card_id, amount) VALUES ($1, $2)`,
    [card.id, card.debt_amount]
  );
  res.status(201).json({
    ...withComputed(card),
    reconciliation: await reconciliationFor(card.id, Number(card.debt_amount)),
    history: await paymentHistory(card.id),
    recent_charges: await recentCharges(card.id),
  });
});

router.put('/:id', async (req, res) => {
  const { name, owner, type, last4, credit_limit, debt_amount, statement_day, due_day, note } = req.body;
  const { rows } = await pool.query(
    `UPDATE credit_cards SET name=$1, owner=$2, type=$3, last4=$4, credit_limit=$5, debt_amount=$6, statement_day=$7, due_day=$8, note=$9 WHERE id=$10 RETURNING *`,
    [name, owner, type, last4 || null, credit_limit || null, debt_amount, statement_day || null, due_day || null, note ?? null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  const card = rows[0];
  await pool.query(
    `INSERT INTO credit_card_debt_log (credit_card_id, amount) VALUES ($1, $2)`,
    [card.id, card.debt_amount]
  );
  res.json({
    ...withComputed(card),
    reconciliation: await reconciliationFor(card.id, Number(card.debt_amount)),
    history: await paymentHistory(card.id),
    recent_charges: await recentCharges(card.id),
  });
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM credit_cards WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Kart bulunamadı' });
  res.status(204).end();
});

export default router;
