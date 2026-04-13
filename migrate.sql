-- ============================================================
-- MIGRATION — à exécuter une seule fois sur la base existante
-- ============================================================

-- 1. Colonne order_reference sur deliveries
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS order_reference VARCHAR(100);

-- 2. Table ventes particuliers
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

-- Fonction updated_at (idempotent)
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger updated_at pour private_sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sales_upd'
  ) THEN
    CREATE TRIGGER trg_sales_upd
      BEFORE UPDATE ON private_sales
      FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
  END IF;
END;
$$;
