-- Migration idempotente, compatible Railway Query runner
-- (pas de blocs DO $$ ... $$ qui cassent sur le split par ';')

-- 1. Champs livraisons / enseignes
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS order_reference VARCHAR(100);
ALTER TABLE stores     ADD COLUMN IF NOT EXISTS has_returns BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Produits (catalogue)
CREATE TABLE IF NOT EXISTS products (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  unit           VARCHAR(50)  NOT NULL DEFAULT 'unité',
  unit_price_ht  NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_rate       NUMERIC(5,2)  NOT NULL DEFAULT 20.00,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);

-- 3. Ventes particuliers
CREATE TABLE IF NOT EXISTS private_sales (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sale_date       DATE NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  payment_method  VARCHAR(20) NOT NULL DEFAULT 'cash'
                    CHECK (payment_method IN ('card', 'cash')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_user ON private_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON private_sales(user_id, sale_date);

-- 4. Colonnes snapshot legacy sur deliveries (pour rétrocompat migration)
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS unit_price_ht NUMERIC(10,2);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS vat_rate      NUMERIC(5,2);

-- 5. Lignes multi-produits : bon de livraison
CREATE TABLE IF NOT EXISTS delivery_items (
  id                 SERIAL PRIMARY KEY,
  delivery_id        INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id         INTEGER REFERENCES products(id) ON DELETE SET NULL,
  quantity_delivered INTEGER NOT NULL DEFAULT 0 CHECK (quantity_delivered >= 0),
  quantity_recovered INTEGER NOT NULL DEFAULT 0 CHECK (quantity_recovered >= 0),
  unit_price_ht      NUMERIC(10,2),
  vat_rate           NUMERIC(5,2),
  position           INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items(delivery_id);

-- 6. Lignes multi-produits : vente particulier
CREATE TABLE IF NOT EXISTS sale_items (
  id            SERIAL PRIMARY KEY,
  sale_id       INTEGER NOT NULL REFERENCES private_sales(id) ON DELETE CASCADE,
  product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
  quantity      INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price_ht NUMERIC(10,2),
  vat_rate      NUMERIC(5,2),
  position      INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

-- 7. Backfill : 1 ligne par bon existant sans items
INSERT INTO delivery_items (delivery_id, product_id, quantity_delivered, quantity_recovered, unit_price_ht, vat_rate, position)
SELECT d.id, d.product_id, d.quantity_delivered, d.quantity_recovered, d.unit_price_ht, d.vat_rate, 1
FROM deliveries d
WHERE NOT EXISTS (SELECT 1 FROM delivery_items i WHERE i.delivery_id = d.id);

INSERT INTO sale_items (sale_id, product_id, quantity, unit_price_ht, vat_rate, position)
SELECT s.id, NULL, s.quantity, NULL, NULL, 1
FROM private_sales s
WHERE NOT EXISTS (SELECT 1 FROM sale_items i WHERE i.sale_id = s.id);

-- 8. Fonction + triggers updated_at
CREATE OR REPLACE FUNCTION _set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $fn$;

DROP TRIGGER IF EXISTS trg_sales_upd ON private_sales;
CREATE TRIGGER trg_sales_upd BEFORE UPDATE ON private_sales FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

DROP TRIGGER IF EXISTS trg_products_upd ON products;
CREATE TRIGGER trg_products_upd BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
