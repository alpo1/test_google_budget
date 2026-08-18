-- Home budget / receipt tracker — relational core.
--
-- This replaces the original procurement schema. The engineering shape is the
-- same (foreign keys + a transaction in code keep a receipt and its line items
-- consistent), but the domain is now personal household spending:
--   stores → receipts (with line items) → categorised into a monthly budget,
--   plus a global product catalog keyed by barcode and an in-app shopping list.
--
-- migrate.ts runs this file wholesale. Every statement is IF NOT EXISTS /
-- idempotent, so re-running is safe. NOTE: on a database that still holds the
-- old procurement tables this only *adds* the new ones — start from a fresh
-- database (or DROP the old tables) when pivoting.

-- Members of the household. Kept from the original model; `role` is retained so
-- a single "admin" can do destructive actions (delete a store/category), while
-- everyone can add receipts and tick the shopping list.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member',   -- 'member' | 'admin'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget categories (Groceries, Dining, Household, Pharmacy, ...).
-- monthly_budget is an OPTIONAL soft cap; actual spend is never stored here —
-- it is derived by summing confirmed receipts per category per month.
CREATE TABLE IF NOT EXISTS categories (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE,
  monthly_budget NUMERIC(12,2) CHECK (monthly_budget IS NULL OR monthly_budget >= 0),
  color          TEXT,                            -- optional, for the UI
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Where you shop (was `suppliers`). `chain` groups branches of the same brand
-- (e.g. many "Rami Levy" branches), which is handy for reporting.
CREATE TABLE IF NOT EXISTS stores (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  chain      TEXT,
  location   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Global product catalog, identified by barcode. A barcode identifies a product
-- independently of any store, so (unlike the old per-supplier catalog) it is
-- globally UNIQUE. Price is deliberately NOT here — price is store- and
-- time-dependent and lives on receipt_items (what you actually paid).
-- The catalog grows as you scan; default_category lets a scanned product
-- pre-fill its budget category.
CREATE TABLE IF NOT EXISTS products (
  id                  SERIAL PRIMARY KEY,
  barcode             TEXT UNIQUE,                 -- EAN/UPC; nullable (loose items have none)
  name                TEXT NOT NULL,
  brand               TEXT,
  default_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A single shopping trip / receipt (was `purchase_orders`).
--
--  total        The authoritative amount actually paid, taken from the receipt
--               itself. It is NOT recomputed from line items: real receipts
--               differ from the item sum because of discounts, promotions,
--               rounding and deposits (פיקדון). This column is the source of
--               truth for the budget. NUMERIC(12,2) comes back from `pg` as a
--               string and is kept as a string end-to-end (no float rounding).
--  purchased_at The date printed on the receipt — this is what decides which
--               month/budget the spend counts toward, distinct from created_at
--               (when the row was inserted / the photo was scanned).
--  status       'draft'     = created by OCR, awaiting human review
--               'confirmed' = reviewed; counts toward the budget
--  source       how the receipt entered the system
--  image_path   pointer to the stored photo (object-storage key or path); null
--               for manually entered receipts
CREATE TABLE IF NOT EXISTS receipts (
  id           SERIAL PRIMARY KEY,
  store_id     INTEGER REFERENCES stores(id) ON DELETE SET NULL,
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_by   INTEGER NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'draft'      -- 'draft' | 'confirmed'
               CHECK (status IN ('draft', 'confirmed')),
  source       TEXT NOT NULL DEFAULT 'manual'     -- 'manual' | 'scan'
               CHECK (source IN ('manual', 'scan')),
  total        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  currency     TEXT NOT NULL DEFAULT 'ILS',
  image_path   TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Line items on a receipt (was `order_items`). Deleting a receipt removes its
-- items (CASCADE), exactly as before. product_id links a line to the global
-- catalog when a barcode was matched; it stays null for un-scanned lines.
CREATE TABLE IF NOT EXISTS receipt_items (
  id          SERIAL PRIMARY KEY,
  receipt_id  INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity    NUMERIC(10,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),  -- NUMERIC: some goods sell by weight (kg)
  unit_price  NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0)
);

-- In-app shopping list. Reminders has no public web API (Shortcuts is the only
-- reliable iOS bridge), so the list is a first-class table here; ticking an item
-- sets is_checked. product_id lets a checked item feed the catalog / auto-fill.
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  quantity   TEXT,                                -- free text ("2 kg", "a pack")
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  added_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_checked BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for the hot paths: monthly budget rollups scan receipts by date and
-- category; item lookups and product/barcode matching happen constantly.
CREATE INDEX IF NOT EXISTS idx_receipts_purchased_at ON receipts (purchased_at);
CREATE INDEX IF NOT EXISTS idx_receipts_category      ON receipts (category_id);
CREATE INDEX IF NOT EXISTS idx_receipts_store         ON receipts (store_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt  ON receipt_items (receipt_id);
CREATE INDEX IF NOT EXISTS idx_shopping_open          ON shopping_list_items (is_checked);

-- A few starter categories so a fresh install isn't empty. Idempotent.
INSERT INTO categories (name) VALUES
  ('Groceries'), ('Dining'), ('Household'), ('Pharmacy'), ('Transport'), ('Other')
ON CONFLICT (name) DO NOTHING;
