const { validationResult } = require('express-validator');
const db = require('../config/database');

// ── helpers ──────────────────────────────────────────────────────────────────

async function assertStoreOwner(storeId, userId) {
  const { rows } = await db.query(
    'SELECT id FROM stores WHERE id = $1 AND user_id = $2 AND is_active = TRUE',
    [storeId, userId]
  );
  return rows.length > 0;
}

async function nextDeliveryNumber(storeId, client) {
  const q = client || db;
  const { rows: [r] } = await q.query(
    `SELECT COALESCE(MAX(delivery_number), 0) + 1 AS n FROM deliveries WHERE store_id = $1`,
    [storeId]
  );
  return r.n;
}

// Normalise une ligne de produit reçue du client
function normalizeItem(raw, position) {
  return {
    product_id:         raw.product_id != null ? Number(raw.product_id) : null,
    quantity_delivered: Number(raw.quantity_delivered) || 0,
    quantity_recovered: Number(raw.quantity_recovered) || 0,
    unit_price_ht:      raw.unit_price_ht != null && raw.unit_price_ht !== '' ? Number(raw.unit_price_ht) : null,
    vat_rate:           raw.vat_rate      != null && raw.vat_rate      !== '' ? Number(raw.vat_rate)      : null,
    position,
  };
}

// Complète prix/TVA depuis le produit catalogue si non fournis
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

async function insertItems(client, deliveryId, items) {
  for (const it of items) {
    await client.query(
      `INSERT INTO delivery_items
         (delivery_id, product_id, quantity_delivered, quantity_recovered, unit_price_ht, vat_rate, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [deliveryId, it.product_id, it.quantity_delivered, it.quantity_recovered,
       it.unit_price_ht, it.vat_rate, it.position]
    );
  }
}

async function fetchItems(deliveryIds) {
  if (deliveryIds.length === 0) return new Map();
  const { rows } = await db.query(
    `SELECT i.*, p.name AS product_name, p.unit AS product_unit
     FROM delivery_items i
     LEFT JOIN products p ON p.id = i.product_id
     WHERE i.delivery_id = ANY($1::int[])
     ORDER BY i.delivery_id, i.position, i.id`,
    [deliveryIds]
  );
  const byDelivery = new Map();
  for (const r of rows) {
    if (!byDelivery.has(r.delivery_id)) byDelivery.set(r.delivery_id, []);
    byDelivery.get(r.delivery_id).push(r);
  }
  return byDelivery;
}

// Totaux livraison = SOMME des lignes
function totalsFromItems(items) {
  const delivered = items.reduce((s, i) => s + (Number(i.quantity_delivered) || 0), 0);
  const recovered = items.reduce((s, i) => s + (Number(i.quantity_recovered) || 0), 0);
  return { delivered, recovered };
}

// Attache items + totaux calculés aux lignes de livraison
async function attachItems(deliveries) {
  const ids = deliveries.map((d) => d.id);
  const itemsMap = await fetchItems(ids);
  return deliveries.map((d) => {
    const items = itemsMap.get(d.id) || [];
    return { ...d, items, total_quantity: d.quantity_delivered - d.quantity_recovered };
  });
}

// ── controllers ───────────────────────────────────────────────────────────────

async function listDeliveries(req, res, next) {
  try {
    const { store_id, date, month, year, status } = req.query;

    let where = 'WHERE d.user_id = $1';
    const params = [req.userId];

    if (store_id) { params.push(store_id); where += ` AND d.store_id = $${params.length}`; }
    if (date)     { params.push(date);     where += ` AND d.delivery_date = $${params.length}`; }
    if (month)    { params.push(month);    where += ` AND EXTRACT(MONTH FROM d.delivery_date) = $${params.length}`; }
    if (year)     { params.push(year);     where += ` AND EXTRACT(YEAR  FROM d.delivery_date) = $${params.length}`; }
    if (status)   { params.push(status);   where += ` AND d.status = $${params.length}`; }

    const { rows } = await db.query(
      `SELECT d.*,
              (d.quantity_delivered - d.quantity_recovered) AS total_quantity,
              s.name AS store_name
       FROM deliveries d
       JOIN stores s ON s.id = d.store_id
       ${where}
       ORDER BY d.delivery_date DESC, d.delivery_number DESC`,
      params
    );
    res.json(await attachItems(rows));
  } catch (err) {
    next(err);
  }
}

async function getDelivery(req, res, next) {
  try {
    const { rows: [d] } = await db.query(
      `SELECT d.*,
              (d.quantity_delivered - d.quantity_recovered) AS total_quantity,
              s.name AS store_name
       FROM deliveries d
       JOIN stores s ON s.id = d.store_id
       WHERE d.id = $1 AND d.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (!d) return res.status(404).json({ error: 'Livraison introuvable' });
    const [withItems] = await attachItems([d]);
    res.json(withItems);
  } catch (err) {
    next(err);
  }
}

async function createDelivery(req, res, next) {
  const client = await db.connect();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { store_id, delivery_date, order_reference, notes } = req.body;
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (rawItems.length === 0) {
      return res.status(400).json({ error: 'Au moins une ligne produit est requise' });
    }

    if (!(await assertStoreOwner(store_id, req.userId))) {
      return res.status(404).json({ error: 'Enseigne introuvable' });
    }

    const items = rawItems.map((r, idx) => normalizeItem(r, idx + 1));

    await client.query('BEGIN');

    for (const it of items) await hydrateItemFromProduct(it, req.userId, client);

    const { delivered, recovered } = totalsFromItems(items);

    const deliveryNumber = await nextDeliveryNumber(store_id, client);

    const { rows: [d] } = await client.query(
      `INSERT INTO deliveries
         (user_id, store_id, delivery_date, delivery_number,
          quantity_delivered, quantity_recovered, order_reference, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.userId, store_id, delivery_date, deliveryNumber,
       delivered, recovered, order_reference || null, notes || null]
    );

    await insertItems(client, d.id, items);

    await client.query('COMMIT');

    const [withItems] = await attachItems([{ ...d, total_quantity: delivered - recovered }]);
    res.status(201).json(withItems);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  } finally {
    client.release();
  }
}

async function updateDelivery(req, res, next) {
  const client = await db.connect();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { delivery_date, status, order_reference, notes } = req.body;
    const rawItems = Array.isArray(req.body.items) ? req.body.items : null;

    // Vérifier propriété
    const { rows: [existing] } = await client.query(
      'SELECT id FROM deliveries WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!existing) return res.status(404).json({ error: 'Livraison introuvable' });

    await client.query('BEGIN');

    let delivered = null, recovered = null;
    if (rawItems !== null) {
      if (rawItems.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Au moins une ligne produit est requise' });
      }
      const items = rawItems.map((r, idx) => normalizeItem(r, idx + 1));
      for (const it of items) await hydrateItemFromProduct(it, req.userId, client);
      await client.query('DELETE FROM delivery_items WHERE delivery_id = $1', [existing.id]);
      await insertItems(client, existing.id, items);
      const totals = totalsFromItems(items);
      delivered = totals.delivered;
      recovered = totals.recovered;
    }

    const { rows: [d] } = await client.query(
      `UPDATE deliveries
       SET delivery_date      = COALESCE($1, delivery_date),
           quantity_delivered = COALESCE($2, quantity_delivered),
           quantity_recovered = COALESCE($3, quantity_recovered),
           status             = COALESCE($4, status),
           order_reference    = COALESCE($5, order_reference),
           notes              = COALESCE($6, notes)
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [delivery_date, delivered, recovered, status, order_reference, notes,
       req.params.id, req.userId]
    );

    await client.query('COMMIT');

    const [withItems] = await attachItems([{ ...d, total_quantity: d.quantity_delivered - d.quantity_recovered }]);
    res.json(withItems);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  } finally {
    client.release();
  }
}

async function patchStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['pending', 'ok'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    const { rows: [d] } = await db.query(
      `UPDATE deliveries SET status = $1
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [status, req.params.id, req.userId]
    );
    if (!d) return res.status(404).json({ error: 'Livraison introuvable' });
    const [withItems] = await attachItems([{ ...d, total_quantity: d.quantity_delivered - d.quantity_recovered }]);
    res.json(withItems);
  } catch (err) {
    next(err);
  }
}

async function deleteDelivery(req, res, next) {
  try {
    const { rows: [d] } = await db.query(
      'DELETE FROM deliveries WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (!d) return res.status(404).json({ error: 'Livraison introuvable' });
    res.json({ message: 'Livraison supprimée' });
  } catch (err) {
    next(err);
  }
}

async function todayDeliveries(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await db.query(
      `SELECT d.*,
              (d.quantity_delivered - d.quantity_recovered) AS total_quantity,
              s.name AS store_name
       FROM deliveries d
       JOIN stores s ON s.id = d.store_id
       WHERE d.user_id = $1 AND d.delivery_date = $2
       ORDER BY d.store_id, d.delivery_number`,
      [req.userId, today]
    );
    res.json(await attachItems(rows));
  } catch (err) {
    next(err);
  }
}

async function monthlyTotal(req, res, next) {
  try {
    const { month, year } = req.query;
    const m = parseInt(month, 10) || new Date().getMonth() + 1;
    const y = parseInt(year, 10)  || new Date().getFullYear();

    const { rows: [r] } = await db.query(
      `SELECT
         COUNT(id)::int                                          AS deliveries,
         COALESCE(SUM(quantity_delivered), 0)::int              AS qty_delivered,
         COALESCE(SUM(quantity_recovered), 0)::int              AS qty_recovered,
         COALESCE(SUM(quantity_delivered - quantity_recovered), 0)::int AS total_quantity
       FROM deliveries
       WHERE user_id = $1
         AND EXTRACT(YEAR  FROM delivery_date) = $2
         AND EXTRACT(MONTH FROM delivery_date) = $3`,
      [req.userId, y, m]
    );
    res.json({ month: m, year: y, ...r });
  } catch (err) {
    next(err);
  }
}

async function upcomingDeliveries(req, res, next) {
  try {
    const days = Math.min(parseInt(req.query.days, 10) || 7, 30);
    const dates = [];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    const from = dates[0];
    const to   = dates[dates.length - 1];

    const { rows: existing } = await db.query(
      `SELECT d.*,
              (d.quantity_delivered - d.quantity_recovered) AS total_quantity,
              s.name AS store_name
       FROM deliveries d
       JOIN stores s ON s.id = d.store_id
       WHERE d.user_id = $1 AND d.delivery_date BETWEEN $2 AND $3
       ORDER BY d.delivery_date, d.store_id`,
      [req.userId, from, to]
    );

    const existingWithItems = await attachItems(existing);

    const { rows: rules } = await db.query(
      `SELECT r.*, s.name AS store_name
       FROM recurring_deliveries r
       JOIN stores s ON s.id = r.store_id
       WHERE r.user_id = $1 AND r.is_active = TRUE`,
      [req.userId]
    );

    const result = dates.map((dateStr) => {
      const dayOfMonth = parseInt(dateStr.split('-')[2], 10);
      const dayDeliveries = existingWithItems.filter((d) => d.delivery_date.toISOString
        ? d.delivery_date.toISOString().slice(0, 10) === dateStr
        : String(d.delivery_date).slice(0, 10) === dateStr
      );
      const plannedRules = rules.filter((r) =>
        r.day_of_month === dayOfMonth &&
        !dayDeliveries.some((d) => d.store_id === r.store_id)
      );
      return { date: dateStr, deliveries: dayDeliveries, planned: plannedRules };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDeliveries, getDelivery, createDelivery, updateDelivery,
  patchStatus, deleteDelivery, todayDeliveries, monthlyTotal, upcomingDeliveries,
};
