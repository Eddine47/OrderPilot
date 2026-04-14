-- ============================================================
-- Livraison SaaS - PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS (multi-tenant: each user owns their data)
-- ============================================================
CREATE TABLE users (
  id               SERIAL PRIMARY KEY,
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  name             VARCHAR(255) NOT NULL,
  company_name     VARCHAR(255) NOT NULL DEFAULT 'Ma Société',
  company_address  TEXT,
  company_siret    VARCHAR(50),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STORES  (Enseignes / clients livrés)
-- ============================================================
CREATE TABLE stores (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  address       TEXT,
  contact_name  VARCHAR(255),
  contact_phone VARCHAR(50),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  has_returns   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS  (Catalogue)
-- ============================================================
CREATE TABLE products (
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

-- ============================================================
-- DELIVERIES  (Livraisons)
-- ============================================================
CREATE TABLE deliveries (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id           INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  delivery_date      DATE NOT NULL,
  delivery_number    INTEGER NOT NULL,
  quantity_delivered INTEGER NOT NULL DEFAULT 0 CHECK (quantity_delivered >= 0),
  quantity_recovered INTEGER NOT NULL DEFAULT 0 CHECK (quantity_recovered >= 0),
  is_recurring       BOOLEAN NOT NULL DEFAULT FALSE,
  status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'ok')),
  order_reference    VARCHAR(100),
  product_id         INTEGER REFERENCES products(id) ON DELETE SET NULL,
  unit_price_ht      NUMERIC(10,2),
  vat_rate           NUMERIC(5,2),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, delivery_number)
);

-- ============================================================
-- DELIVERY ITEMS  (lignes produits des bons de livraison)
-- ============================================================
CREATE TABLE delivery_items (
  id                 SERIAL PRIMARY KEY,
  delivery_id        INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id         INTEGER REFERENCES products(id) ON DELETE SET NULL,
  quantity_delivered INTEGER NOT NULL DEFAULT 0 CHECK (quantity_delivered >= 0),
  quantity_recovered INTEGER NOT NULL DEFAULT 0 CHECK (quantity_recovered >= 0),
  unit_price_ht      NUMERIC(10,2),
  vat_rate           NUMERIC(5,2),
  position           INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- PRIVATE SALES  (Ventes particuliers)
-- ============================================================
CREATE TABLE private_sales (
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

CREATE TABLE sale_items (
  id            SERIAL PRIMARY KEY,
  sale_id       INTEGER NOT NULL REFERENCES private_sales(id) ON DELETE CASCADE,
  product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
  quantity      INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price_ht NUMERIC(10,2),
  vat_rate      NUMERIC(5,2),
  position      INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- RECURRING DELIVERY RULES  (Livraisons récurrentes par jour du mois)
-- ============================================================
CREATE TABLE recurring_deliveries (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id      INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  day_of_month  INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_stores_user         ON stores(user_id);
CREATE INDEX idx_stores_user_active  ON stores(user_id, is_active);

CREATE INDEX idx_del_user            ON deliveries(user_id);
CREATE INDEX idx_del_store           ON deliveries(store_id);
CREATE INDEX idx_del_date            ON deliveries(delivery_date);
CREATE INDEX idx_del_user_date       ON deliveries(user_id, delivery_date);
CREATE INDEX idx_del_store_date      ON deliveries(store_id, delivery_date);
CREATE INDEX idx_del_status          ON deliveries(user_id, status);
CREATE INDEX idx_del_recurring       ON deliveries(user_id, is_recurring);

CREATE INDEX idx_rec_user            ON recurring_deliveries(user_id);
CREATE INDEX idx_rec_store           ON recurring_deliveries(store_id);

CREATE INDEX idx_sales_user          ON private_sales(user_id);
CREATE INDEX idx_sales_date          ON private_sales(user_id, sale_date);

CREATE INDEX idx_products_user       ON products(user_id);

CREATE INDEX idx_delivery_items_delivery ON delivery_items(delivery_id);
CREATE INDEX idx_sale_items_sale         ON sale_items(sale_id);

-- ============================================================
-- UPDATED_AT AUTO-TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_upd
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

CREATE TRIGGER trg_stores_upd
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

CREATE TRIGGER trg_deliveries_upd
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

CREATE TRIGGER trg_recurring_upd
  BEFORE UPDATE ON recurring_deliveries
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

CREATE TRIGGER trg_sales_upd
  BEFORE UPDATE ON private_sales
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

CREATE TRIGGER trg_products_upd
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION _set_updated_at();

-- ============================================================
-- DONNÉES DE DÉMONSTRATION
-- Société : L'Arche de Noé Lavash   mot de passe : Demo1234
-- ============================================================

INSERT INTO users (email, password_hash, name, company_name, company_address, company_siret)
VALUES (
  'contact@archedenoe-lavash.fr',
  '$2a$12$gEDWomJTYmbX9wO/Q6svA.6GdUzAyYGLijXZjAWEuap7kJi.3w22C',
  'Mehdi Karimian',
  'L''Arche de Noé Lavash',
  '14 rue des Artisans, 93100 Montreuil',
  '812 345 678 00015'
);

INSERT INTO stores (user_id, name, address, contact_name, contact_phone) VALUES
  (1, 'Carrefour Market Vincennes',  '3 av. de Paris, 94300 Vincennes',         'Sophie Lambert',  '01 43 28 11 22'),
  (1, 'Monoprix Nation',             '148 av. du Trône, 75012 Paris',            'Thomas Girard',   '01 43 07 55 80'),
  (1, 'Bio C'' Bon Bastille',        '22 bd Beaumarchais, 75011 Paris',          'Camille Rousseau','01 48 06 34 90'),
  (1, 'Carrefour Market Nogent',     '5 rue du Port, 94130 Nogent-sur-Marne',    'Pierre Dumont',   '01 48 72 43 10'),
  (1, 'G20 Charonne',               '87 rue de Charonne, 75011 Paris',           'Laila Benali',    '01 43 72 18 65'),
  (1, 'Franprix Gambetta',          '210 rue des Pyrénées, 75020 Paris',          'Marc Lefevre',    '01 46 36 04 17');

-- Règles récurrentes (jours du mois)
-- Stores 1,2,5,6 : jours 3, 10, 17, 24
-- Store 3        : jours 4, 11, 18, 25
-- Store 4        : jours 5, 12, 19, 26
INSERT INTO recurring_deliveries (user_id, store_id, day_of_month, quantity) VALUES
  (1, 1,  3, 40), (1, 1, 10, 40), (1, 1, 17, 40), (1, 1, 24, 40),
  (1, 2,  3, 60), (1, 2, 10, 60), (1, 2, 17, 60), (1, 2, 24, 60),
  (1, 3,  4, 20), (1, 3, 11, 20), (1, 3, 18, 20), (1, 3, 25, 20),
  (1, 4,  5, 30), (1, 4, 12, 30), (1, 4, 19, 30), (1, 4, 26, 30),
  (1, 5,  3, 25), (1, 5, 10, 25), (1, 5, 17, 25), (1, 5, 24, 25),
  (1, 6,  3, 15), (1, 6, 10, 15), (1, 6, 17, 15), (1, 6, 24, 15);

-- Livraisons mars 2026 (is_recurring = TRUE)
INSERT INTO deliveries (user_id, store_id, delivery_date, delivery_number, quantity_delivered, quantity_recovered, status, is_recurring) VALUES
  (1, 1, '2026-03-03',  1, 40, 3, 'ok', TRUE),
  (1, 1, '2026-03-10',  2, 40, 5, 'ok', TRUE),
  (1, 1, '2026-03-17',  3, 40, 2, 'ok', TRUE),
  (1, 1, '2026-03-24',  4, 40, 4, 'ok', TRUE),
  (1, 2, '2026-03-03',  1, 60, 8, 'ok', TRUE),
  (1, 2, '2026-03-10',  2, 60, 6, 'ok', TRUE),
  (1, 2, '2026-03-17',  3, 60, 9, 'ok', TRUE),
  (1, 2, '2026-03-24',  4, 60, 5, 'ok', TRUE),
  (1, 3, '2026-03-04',  1, 20, 2, 'ok', TRUE),
  (1, 3, '2026-03-11',  2, 20, 0, 'ok', TRUE),
  (1, 3, '2026-03-18',  3, 20, 3, 'ok', TRUE),
  (1, 3, '2026-03-25',  4, 20, 1, 'ok', TRUE),
  (1, 4, '2026-03-05',  1, 30, 4, 'ok', TRUE),
  (1, 4, '2026-03-12',  2, 30, 2, 'ok', TRUE),
  (1, 4, '2026-03-19',  3, 30, 5, 'ok', TRUE),
  (1, 4, '2026-03-26',  4, 30, 3, 'ok', TRUE),
  (1, 5, '2026-03-03',  1, 25, 0, 'ok', TRUE),
  (1, 5, '2026-03-10',  2, 25, 2, 'ok', TRUE),
  (1, 5, '2026-03-17',  3, 25, 1, 'ok', TRUE),
  (1, 5, '2026-03-24',  4, 25, 0, 'ok', TRUE),
  (1, 6, '2026-03-03',  1, 15, 1, 'ok', TRUE),
  (1, 6, '2026-03-10',  2, 15, 0, 'ok', TRUE),
  (1, 6, '2026-03-17',  3, 15, 2, 'ok', TRUE),
  (1, 6, '2026-03-24',  4, 15, 0, 'ok', TRUE);

-- Livraisons avril 2026 (is_recurring = TRUE)
INSERT INTO deliveries (user_id, store_id, delivery_date, delivery_number, quantity_delivered, quantity_recovered, status, is_recurring) VALUES
  (1, 1, '2026-04-03',  5, 40, 6, 'ok',      TRUE),
  (1, 1, '2026-04-10',  6, 40, 3, 'pending',  TRUE),
  (1, 1, '2026-04-17',  7, 40, 0, 'pending',  TRUE),
  (1, 1, '2026-04-24',  8, 40, 0, 'pending',  TRUE),
  (1, 2, '2026-04-03',  5, 60, 7, 'ok',      TRUE),
  (1, 2, '2026-04-10',  6, 60, 4, 'pending',  TRUE),
  (1, 2, '2026-04-17',  7, 60, 0, 'pending',  TRUE),
  (1, 2, '2026-04-24',  8, 60, 0, 'pending',  TRUE),
  (1, 3, '2026-04-04',  5, 20, 1, 'ok',      TRUE),
  (1, 3, '2026-04-11',  6, 20, 0, 'pending',  TRUE),
  (1, 3, '2026-04-18',  7, 20, 0, 'pending',  TRUE),
  (1, 3, '2026-04-25',  8, 20, 0, 'pending',  TRUE),
  (1, 4, '2026-04-05',  5, 30, 3, 'ok',      TRUE),
  (1, 4, '2026-04-12',  6, 30, 0, 'pending',  TRUE),
  (1, 4, '2026-04-19',  7, 30, 0, 'pending',  TRUE),
  (1, 4, '2026-04-26',  8, 30, 0, 'pending',  TRUE),
  (1, 5, '2026-04-03',  5, 25, 2, 'ok',      TRUE),
  (1, 5, '2026-04-10',  6, 25, 0, 'pending',  TRUE),
  (1, 5, '2026-04-17',  7, 25, 0, 'pending',  TRUE),
  (1, 5, '2026-04-24',  8, 25, 0, 'pending',  TRUE),
  (1, 6, '2026-04-03',  5, 15, 0, 'ok',      TRUE),
  (1, 6, '2026-04-10',  6, 15, 1, 'pending',  TRUE),
  (1, 6, '2026-04-17',  7, 15, 0, 'pending',  TRUE),
  (1, 6, '2026-04-24',  8, 15, 0, 'pending',  TRUE);
