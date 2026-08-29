import { pool } from './db.js';

export async function adjustCardDebt(cardId, delta) {
  if (!cardId || !delta) return;
  const { rows } = await pool.query(
    'UPDATE credit_cards SET debt_amount = debt_amount + $1 WHERE id=$2 RETURNING debt_amount',
    [delta, cardId]
  );
  if (!rows.length) return;
  await pool.query(
    'INSERT INTO credit_card_debt_log (credit_card_id, amount) VALUES ($1, $2)',
    [cardId, rows[0].debt_amount]
  );
}
