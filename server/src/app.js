import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import 'express-async-errors';

import authRouter from './routes/auth.js';
import { requireAuth } from './auth.js';
import shopsRouter from './routes/shops.js';
import dailyIncomeRouter from './routes/dailyIncome.js';
import dailyExpenseRouter from './routes/dailyExpense.js';
import monthlyExpenseRouter from './routes/monthlyExpense.js';
import summaryRouter from './routes/summary.js';
import aiRouter from './routes/ai.js';
import creditCardsRouter from './routes/creditCards.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api', requireAuth);

app.use('/api/shops', shopsRouter);
app.use('/api/daily-income', dailyIncomeRouter);
app.use('/api/daily-expense', dailyExpenseRouter);
app.use('/api/monthly-expense', monthlyExpenseRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/ai', aiRouter);
app.use('/api/credit-cards', creditCardsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message });
});

export default app;
