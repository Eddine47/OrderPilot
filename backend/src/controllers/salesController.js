const { validationResult } = require('express-validator');
const db = require('../config/database');

// ── helpers ──────────────────────────────────────────────────────────────────

function normalizeItem(raw, position) {
  return {
    product_id:    raw.product_id != null ? Number(raw.product_id) : null,
    quantity:      Number(raw.quantity) || 0,
    unit_price_ht: raw.unit_price_ht != null && raw.unit_price_ht !== '' ? Number(raw.unit_price_ht) : null,
    vat_rate:      raw.vat_rate      != null && raw.vat_rate      !== '' ? Number(raw.vat_rate)      : null,
    position,
  };
}

async function hydrateItemFromProduct(item, userId, client) {
  if (!item.product_id) return item;
  if (item.unit_price_ht != null && item.vat_rate != null) return item;
  const { rows: [p] } = await client.query(
    'SELECT unit_price_ht, vat_rate FROM products WHERE id = $1 AND user_id = $2 AND is_active = TRUE',
    [item.product_id, userId]
  );
  if (!p) throw Object.assign(new Error('Produit introuvable'), { status: 404 });
  if (item.unit_price_ht == null) item.unit_price_ht = Number(p.unit_price_ht);
  if (item.vat_rate      == null) item.vat_rate      = Number(p.vat_rate);
  return item;
}

async function insertItems(client, saleId, items) {
  for (const it of items) {
    await client.query(
      `INSERT INTO sale_items
         (sale_id, product_id, quantity, unit_price_ht, vat_rate, position)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [saleId, it.product_id, it.quantity, it.unit_price_ht, it.vat_rate, it.position]
    );
  }
}

async function fetchItems(saleIds) {
  if (saleIds.length === 0) return new Map();
  const { rows } = await db.query(
    `SELECT i.*, p.name AS product_name, p.unit AS product_unit
     FROM sale_items i
     LEFT JOIN products p ON p.id = i.product_id
     WHERE i.sale_id = ANY($1::int[])
     ORDER BY i.sale_id, i.position, i.id`,
    [saleIds]
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.sale_id)) map.set(r.sale_id, []);
    map.get(r.sale_id).push(r);
  }
  return map;
}

async function attachItems(sales) {
  const ids = sales.map((s) => s.id);
  const map = await fetchItems(ids);
  return sales.map((s) => ({ ...s, items: map.get(s.id) || [] }));
}

function totalQuantity(items) {
  return items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
}

// ── controllers ──────────────────────────────────────────────────────────────

async function listSales(req, res, next) {
  try {
    const { month, year } = req.query;
    let where = 'WHERE user_id = $1';
    const params = [req.userId];

    if (month) { params.push(month); where += ` AND EXTRACT(MONTH FROM sale_date) = $${params.length}`; }
    if (year)  { params.push(year);  where += ` AND EXTRACT(YEAR  FROM sale_date) = $${params.length}`; }

    const { rows } = await db.query(
      `SELECT * FROM private_sales ${where} ORDER BY sale_date DESC, id DESC`,
      params
    );
    res.json(await attachItems(rows));
  } catch (err) {
    next(err);
  }
}

async function createSale(req, res, next) {
  const client = await db.connect();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { sale_date, payment_method, notes } = req.body;
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (rawItems.length === 0) {
      return res.status(400).json({ error: 'Au moins une ligne produit est requise' });
    }

    const items = rawItems.map((r, idx) => normalizeItem(r, idx + 1));

    await client.query('BEGIN');

    for (const it of items) await hydrateItemFromProduct(it, req.userId, client);
    const totalQty = totalQuantity(items);

    const { rows: [s] } = await client.query(
      `INSERT INTO private_sales (user_id, sale_date, quantity, payment_method, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId, sale_date, totalQty, payment_method, notes || null]
    );

    await insertItems(client, s.id, items);

    await client.query('COMMIT');

    const [withItems] = await attachItems([s]);
    res.status(201).json(withItems);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  } finally {
    client.release();
  }
}

async function updateSale(req, res, next) {
  const client = await db.connect();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { sale_date, payment_method, notes } = req.body;
    const rawItems = Array.isArray(req.body.items) ? req.body.items : null;

    const { rows: [existing] } = await client.query(
      'SELECT id FROM private_sales WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!existing) return res.status(404).json({ error: 'Vente introuvable' });

    await client.query('BEGIN');

    let totalQty = null;
    if (rawItems !== null) {
      if (rawItems.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Au moins une ligne produit est requise' });
      }
      const items = rawItems.map((r, idx) => normalizeItem(r, idx + 1));
      for (const it of items) await hydrateItemFromProduct(it, req.userId, client);
      await client.query('DELETE FROM sale_items WHERE sale_id = $1', [existing.id]);
      await insertItems(client, existing.id, items);
      totalQty = totalQuantity(items);
    }

    const { rows: [s] } = await client.query(
      `UPDATE private_sales
       SET sale_date      = COALESCE($1, sale_date),
           quantity       = COALESCE($2, quantity),
           payment_method = COALESCE($3, payment_method),
           notes          = COALESCE($4, notes)
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [sale_date, totalQty, payment_method, notes, req.params.id, req.userId]
    );

    await client.query('COMMIT');

    const [withItems] = await attachItems([s]);
    res.json(withItems);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  } finally {
    client.release();
  }
}

async function deleteSale(req, res, next) {
  try {
    const { rows: [s] } = await db.query(
      'DELETE FROM private_sales WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (!s) return res.status(404).json({ error: 'Vente introuvable' });
    res.json({ message: 'Vente supprimée' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listSales, createSale, updateSale, deleteSale };
