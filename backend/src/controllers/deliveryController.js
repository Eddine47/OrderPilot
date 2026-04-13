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
    res.json(rows);
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
    res.json(d);
  } catch (err) {
    next(err);
  }
}

async function createDelivery(req, res, next) {
  const client = await db.connect();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { store_id, delivery_date, quantity_delivered, quantity_recovered = 0, order_reference, notes } = req.body;

    if (!(await assertStoreOwner(store_id, req.userId))) {
      return res.status(404).json({ error: 'Enseigne introuvable' });
    }

    await client.query('BEGIN');
    const deliveryNumber = await nextDeliveryNumber(store_id, client);

    const { rows: [d] } = await client.query(
      `INSERT INTO deliveries
         (user_id, store_id, delivery_date, delivery_number,
          quantity_delivered, quantity_recovered, order_reference, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.userId, store_id, delivery_date, deliveryNumber,
       quantity_delivered, quantity_recovered, order_reference || null, notes || null]
    );
    await client.query('COMMIT');

    res.status(201).json({ ...d, total_quantity: d.quantity_delivered - d.quantity_recovered });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function updateDelivery(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { delivery_date, quantity_delivered, quantity_recovered, status, order_reference, notes } = req.body;

    const { rows: [d] } = await db.query(
      `UPDATE deliveries
       SET delivery_date      = COALESCE($1, delivery_date),
           quantity_delivered = COALESCE($2, quantity_delivered),
           quantity_recovered = COALESCE($3, quantity_recovered),
           status             = COALESCE($4, status),
           order_reference    = COALESCE($5, order_reference),
           notes              = COALESCE($6, notes)
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [delivery_date, quantity_delivered, quantity_recovered, status, order_reference, notes,
       req.params.id, req.userId]
    );
    if (!d) return res.status(404).json({ error: 'Livraison introuvable' });
    res.json({ ...d, total_quantity: d.quantity_delivered - d.quantity_recovered });
  } catch (err) {
    next(err);
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
    res.json({ ...d, total_quantity: d.quantity_delivered - d.quantity_recovered });
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
    res.json(rows);
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

// Livraisons des N prochains jours (pour la prévisualisation tableau de bord)
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

    // Livraisons existantes sur cette période
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

    // Règles récurrentes actives
    const { rows: rules } = await db.query(
      `SELECT r.*, s.name AS store_name
       FROM recurring_deliveries r
       JOIN stores s ON s.id = r.store_id
       WHERE r.user_id = $1 AND r.is_active = TRUE`,
      [req.userId]
    );

    // Construire le tableau par jour
    const result = dates.map((dateStr) => {
      const dayOfMonth = parseInt(dateStr.split('-')[2], 10);
      const dayDeliveries = existing.filter((d) => d.delivery_date.toISOString
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
