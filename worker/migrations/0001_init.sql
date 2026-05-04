CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  home_currency TEXT NOT NULL DEFAULT 'GBP',
  trip_currency TEXT NOT NULL DEFAULT 'JPY',
  settlement_currency TEXT NOT NULL DEFAULT 'GBP',
  trip_code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  closed_at INTEGER,
  updated_at INTEGER NOT NULL,
  entities_json TEXT,
  supported_currencies_json TEXT,
  participant_count INTEGER,
  trip_notes TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  payer_couple TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  expense_timestamp INTEGER NOT NULL,
  receipt_r2_key TEXT,
  manual_gbp_minor INTEGER,
  fx_rate_used REAL,
  fx_rate_date_used TEXT,
  fx_retrieval_type TEXT,
  converted_gbp_minor INTEGER,
  conversion_mode TEXT NOT NULL DEFAULT 'auto',
  deleted_at INTEGER,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id)
);

CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id);

CREATE TABLE IF NOT EXISTS fx_rates (
  id TEXT PRIMARY KEY,
  rate_date TEXT NOT NULL,
  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  gbp_per_jpy REAL NOT NULL,
  retrieval_type TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
