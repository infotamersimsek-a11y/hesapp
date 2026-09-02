CREATE TABLE IF NOT EXISTS shops (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

INSERT INTO shops (name) VALUES ('Hacıoğulları'), ('Çıtır Tatlı')
  ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS daily_income (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  date DATE NOT NULL,
  method TEXT NOT NULL DEFAULT 'nakit' CHECK (method IN ('nakit', 'pos')),
  amount NUMERIC(12,2) NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS credit_cards (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT 'Tamer',
  type TEXT NOT NULL DEFAULT 'Kredi Kartı',
  last4 TEXT,
  credit_limit NUMERIC(12,2),
  debt_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  statement_day INTEGER CHECK (statement_day BETWEEN 1 AND 31),
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  note TEXT
);

CREATE TABLE IF NOT EXISTS credit_card_debt_log (
  id SERIAL PRIMARY KEY,
  credit_card_id INTEGER NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_expense (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  date DATE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  credit_card_id INTEGER REFERENCES credit_cards(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS monthly_expense (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  vendor_name TEXT NOT NULL,
  category TEXT,
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  credit_card_id INTEGER REFERENCES credit_cards(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_income_date ON daily_income(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_expense_date ON daily_expense(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_monthly_expense_ym ON monthly_expense(shop_id, year, month);
CREATE INDEX IF NOT EXISTS idx_debt_log_card ON credit_card_debt_log(credit_card_id, recorded_at);
