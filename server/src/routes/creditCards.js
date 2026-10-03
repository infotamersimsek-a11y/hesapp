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

export function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
    is_deferred_this_month: card.deferred_month === currentYearMonth(),
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

async function paymentHistoryBatch(cardIds) {
  if (cardIds.length === 0) return new Map();
  const { rows } = await pool.query(
    `SELECT credit_card_id, amount, recorded_at FROM credit_card_debt_log WHERE credit_card_id = ANY($1) ORDER BY credit_card_id, recorded_at DESC`,
    [cardIds]
  );
  const byCard = new Map();
  for (const row of rows) {
    if (!byCard.has(row.credit_card_id)) byCard.set(row.credit_card_id, []);
    byCard.get(row.credit_card_id).push({ amount: Number(row.amount), recorded_at: row.recorded_at });
  }
  const result = new Map();
  for (const [cardId, entries] of byCard) {
    const top = entries.slice(0, 6);
    const history = top.slice(0, 5).map((e, i) => {
      const prev = top[i + 1];
      const delta = prev ? Number((prev.amount - e.amount).toFixed(2)) : null;
      return { ...e, delta };
    });
    result.set(cardId, history);
  }
  return result;
}

async function recentChargesBatch(cardIds) {
  if (cardIds.length === 0) return new Map();
  const since = new Date();
  since.setDate(since.getDate() - 3);
  const { rows } = await pool.query(
    `SELECT credit_card_id, amount, category AS label, date, note FROM daily_expense
     WHERE credit_card_id = ANY($1) AND date >= $2 AND category <> $3 ORDER BY credit_card_id, date DESC, id DESC`,
    [cardIds, toDateStr(since), CARD_PAYMENT_CATEGORY]
  );
  const result = new Map();
  for (const row of rows) {
    if (!result.has(row.credit_card_id)) result.set(row.credit_card_id, []);
    result.get(row.credit_card_id).push({ amount: Number(row.amount), label: row.label, date: row.date, note: row.note });
  }
  return result;
}

async function reconciliationBatch(cardIds, debtNowByCard) {
  if (cardIds.length === 0) return new Map();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = toDateStr(monthStart);

  const [priorLogRes, dailyExpRes, monthlyExpRes] = await Promise.all([
    pool.query(
      `SELECT DISTINCT ON (credit_card_id) credit_card_id, amount FROM credit_card_debt_log
       WHERE credit_card_id = ANY($1) AND recorded_at < $2 ORDER BY credit_card_id, recorded_at DESC`,
      [cardIds, monthStart]
    ),
    pool.query(
      `SELECT credit_card_id, COALESCE(SUM(amount),0) AS total FROM daily_expense
       WHERE credit_card_id = ANY($1) AND date >= $2 GROUP BY credit_card_id`,
      [cardIds, monthStartStr]
    ),
    pool.query(
      `SELECT credit_card_id, COALESCE(SUM(amount),0) AS total FROM monthly_expense
       WHERE credit_card_id = ANY($1) AND year=$2 AND month=$3 GROUP BY credit_card_id`,
      [cardIds, now.getFullYear(), now.getMonth() + 1]
    ),
  ]);
  const priorLogMap = new Map(priorLogRes.rows.map((r) => [r.credit_card_id, Number(r.amount)]));
  const dailyExpMap = new Map(dailyExpRes.rows.map((r) => [r.credit_card_id, Number(r.total)]));
  const monthlyExpMap = new Map(monthlyExpRes.rows.map((r) => [r.credit_card_id, Number(r.total)]));

  const result = new Map();
  for (const cardId of cardIds) {
    const debtStart = priorLogMap.has(cardId) ? priorLogMap.get(cardId) : null;
    const recordedExpense = (dailyExpMap.get(cardId) || 0) + (monthlyExpMap.get(cardId) || 0);
    const debtNow = debtNowByCard.get(cardId);
    const cardSpend = debtStart === null ? null : Number((debtNow - debtStart).toFixed(2));
    const discrepancy = cardSpend === null ? null : Number((cardSpend - recordedExpense).toFixed(2));
    result.set(cardId, {
      month_start: monthStartStr,
      debt_start_of_month: debtStart,
      card_spend_estimate: cardSpend,
      recorded_expense_this_month: recordedExpense,
      discrepancy,
      flagged: discrepancy !== null && Math.abs(discrepancy) > 1,
    });
  }
  return result;
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM credit_cards ORDER BY id');
  const cardIds = rows.map((c) => c.id);
  const debtNowByCard = new Map(rows.map((c) => [c.id, Number(c.debt_amount)]));

  const [historyMap, chargesMap, reconMap] = await Promise.all([
    paymentHistoryBatch(cardIds),
    recentChargesBatch(cardIds),
    reconciliationBatch(cardIds, debtNowByCard),
  ]);

  const withCalc = rows.map((card) => ({
    ...withComputed(card),
    reconciliation: reconMap.get(card.id),
    history: historyMap.get(card.id) || [],
    recent_charges: chargesMap.get(card.id) || [],
  }));
  res.json(withCalc);
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

  const cardsRes = await pool.query('SELECT id, name, owner, type, last4, debt_amount FROM credit_cards ORDER BY id');

  // Tercih edilen: dönem başlangıcından önceki son kayıt (gerçek "başlangıç" değeri)
  const baselineRes = await pool.query(
    `SELECT DISTINCT ON (credit_card_id) credit_card_id, amount, to_char(recorded_at, 'YYYY-MM-DD') AS recorded_date
     FROM credit_card_debt_log
     WHERE recorded_at < $1
     ORDER BY credit_card_id, recorded_at DESC`,
    [periodStart]
  );
  const baselineMap = new Map(baselineRes.rows.map((r) => [r.credit_card_id, { amount: Number(r.amount), date: r.recorded_date, isMonthStart: true }]));

  // Yedek: dönem başından önce hiç kayıt yoksa, dönem içindeki İLK kaydı kullan (örn. kart bu dönemde eklendiyse)
  const fallbackRes = await pool.query(
    `SELECT DISTINCT ON (credit_card_id) credit_card_id, amount, to_char(recorded_at, 'YYYY-MM-DD') AS recorded_date
     FROM credit_card_debt_log
     WHERE recorded_at >= $1 AND recorded_at < $2
     ORDER BY credit_card_id, recorded_at ASC`,
    [periodStart, periodEnd]
  );
  for (const r of fallbackRes.rows) {
    if (!baselineMap.has(r.credit_card_id)) {
      baselineMap.set(r.credit_card_id, { amount: Number(r.amount), date: r.recorded_date, isMonthStart: false });
    }
  }

  const byCard = cardsRes.rows
    .filter((c) => baselineMap.has(c.id))
    .map((c) => {
      const currentDebt = Number(c.debt_amount);
      const baseline = baselineMap.get(c.id);
      return {
        name: c.name,
        owner: c.owner,
        type: c.type,
        last4: c.last4,
        startDebt: baseline.amount,
        startDate: baseline.date,
        isMonthStart: baseline.isMonthStart,
        currentDebt,
        paid: Number((baseline.amount - currentDebt).toFixed(2)),
      };
    });
  const totalPaid = Number(byCard.reduce((s, c) => s + c.paid, 0).toFixed(2));
  res.json({ totalPaid, byCard });
});

router.put('/:id/defer', async (req, res) => {
  const { deferred } = req.body;
  const value = deferred ? currentYearMonth() : null;
  const { rows } = await pool.query(
    'UPDATE credit_cards SET deferred_month=$1 WHERE id=$2 RETURNING *',
    [value, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(withComputed(rows[0]));
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
