const { validationResult } = require('express-validator');
const db = require('../config/database');

async function listStores(req, res, next) {
  try {
    const { search } = req.query;
    let query = `
      SELECT s.*,
             COUNT(d.id)::int AS delivery_count,
             COALESCE(SUM(d.quantity_delivered - d.quantity_recovered), 0)::int AS total_quantity
      FROM stores s
      LEFT JOIN deliveries d ON d.store_id = s.id
      WHERE s.user_id = $1 AND s.is_active = TRUE
    `;
    const params = [req.userId];
    if (search) {
      params.push(`%${search}%`);
      query += ` AND s.name ILIKE $${params.length}`;
    }
    query += ' GROUP BY s.id ORDER BY s.name ASC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getStore(req, res, next) {
  try {
    const { rows: [store] } = await db.query(
      'SELECT * FROM stores WHERE id = $1 AND user_id = $2 AND is_active = TRUE',
      [req.params.id, req.userId]
    );
    if (!store) return res.status(404).json({ error: 'Enseigne introuvable' });
    res.json(store);
  } catch (err) {
    next(err);
  }
}

async function createStore(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, address, contact_name, contact_phone, has_returns } = req.body;
    const { rows: [store] } = await db.query(
      `INSERT INTO stores (user_id, name, address, contact_name, contact_phone, has_returns)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.userId, name, address || null, contact_name || null, contact_phone || null, has_returns ?? false]
    );
    res.status(201).json(store);
  } catch (err) {
    next(err);
  }
}

async function updateStore(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, address, contact_name, contact_phone, has_returns } = req.body;
    const { rows: [store] } = await db.query(
      `UPDATE stores
       SET name          = COALESCE($1, name),
           address       = COALESCE($2, address),
           contact_name  = COALESCE($3, contact_name),
           contact_phone = COALESCE($4, contact_phone),
           has_returns   = COALESCE($5, has_returns)
       WHERE id = $6 AND user_id = $7 AND is_active = TRUE
       RETURNING *`,
      [name, address, contact_name, contact_phone,
       has_returns !== undefined ? has_returns : null,
       req.params.id, req.userId]
    );
    if (!store) return res.status(404).json({ error: 'Enseigne introuvable' });
    res.json(store);
  } catch (err) {
    next(err);
  }
}

async function deleteStore(req, res, next) {
  try {
    const { rows: [store] } = await db.query(
      `UPDATE stores SET is_active = FALSE
       WHERE id = $1 AND user_id = $2 AND is_active = TRUE
       RETURNING id`,
      [req.params.id, req.userId]
    );
    if (!store) return res.status(404).json({ error: 'Enseigne introuvable' });
    res.json({ message: 'Enseigne supprimée' });
  } catch (err) {
    next(err);
  }
}

/**
 * Monthly slip data: all deliveries for a store in a given month
 */
async function getMonthlySlip(req, res, next) {
  try {
    const { month, year } = req.query;
    const m = parseInt(month, 10) || new Date().getMonth() + 1;
    const y = parseInt(year, 10)  || new Date().getFullYear();

    // Verify ownership
    const { rows: [store] } = await db.query(
      'SELECT * FROM stores WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!store) return res.status(404).json({ error: 'Enseigne introuvable' });

    // Slip number = how many distinct months have had deliveries up to and including this one
    const { rows: [slipRow] } = await db.query(
      `SELECT COUNT(DISTINCT DATE_TRUNC('month', delivery_date))::int AS slip_number
       FROM deliveries
       WHERE store_id = $1
         AND DATE_TRUNC('month', delivery_date) <= make_date($2, $3, 1)`,
      [req.params.id, y, m]
    );

    const { rows: deliveries } = await db.query(
      `SELECT d.*,
              (d.quantity_delivered - d.quantity_recovered) AS total_quantity
       FROM deliveries d
       WHERE d.store_id = $1
         AND EXTRACT(YEAR  FROM d.delivery_date) = $2
         AND EXTRACT(MONTH FROM d.delivery_date) = $3
       ORDER BY d.delivery_date ASC, d.delivery_number ASC`,
      [req.params.id, y, m]
    );

    // Charger les lignes produits (items) de toutes les livraisons
    const delIds = deliveries.map((d) => d.id);
    let itemsByDelivery = new Map();
    if (delIds.length > 0) {
      const { rows: items } = await db.query(
        `SELECT i.*, p.name AS product_name, p.unit AS product_unit
         FROM delivery_items i
         LEFT JOIN products p ON p.id = i.product_id
         WHERE i.delivery_id = ANY($1::int[])
         ORDER BY i.delivery_id, i.position, i.id`,
        [delIds]
      );
      for (const it of items) {
        if (!itemsByDelivery.has(it.delivery_id)) itemsByDelivery.set(it.delivery_id, []);
        itemsByDelivery.get(it.delivery_id).push(it);
      }
    }
    for (const d of deliveries) {
      d.items = itemsByDelivery.get(d.id) || [];
    }

    const grandTotal = deliveries.reduce((s, d) => s + Number(d.total_quantity), 0);
    const grandTotalHt = deliveries.reduce((s, d) => s + d.items.reduce((acc, i) => {
      const qty   = (Number(i.quantity_delivered) || 0) - (Number(i.quantity_recovered) || 0);
      const price = Number(i.unit_price_ht) || 0;
      return acc + qty * price;
    }, 0), 0);
    const grandTotalTtc = deliveries.reduce((s, d) => s + d.items.reduce((acc, i) => {
      const qty   = (Number(i.quantity_delivered) || 0) - (Number(i.quantity_recovered) || 0);
      const price = Number(i.unit_price_ht) || 0;
      const vat   = Number(i.vat_rate) || 0;
      return acc + qty * price * (1 + vat / 100);
    }, 0), 0);

    // User company info
    const { rows: [user] } = await db.query(
      'SELECT name, company_name, company_address, company_siret FROM users WHERE id = $1',
      [req.userId]
    );

    res.json({
      store,
      user,
      month: m,
      year: y,
      slip_number: slipRow.slip_number || 1,
      deliveries,
      grand_total: grandTotal,
      grand_total_ht: Number(grandTotalHt.toFixed(2)),
      grand_total_ttc: Number(grandTotalTtc.toFixed(2)),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Monthly summary per store (total quantity for a given month)
 */
async function getMonthlySummary(req, res, next) {
  try {
    const { month, year } = req.query;
    const m = parseInt(month, 10) || new Date().getMonth() + 1;
    const y = parseInt(year, 10)  || new Date().getFullYear();

    const { rows } = await db.query(
      `SELECT s.id, s.name,
              COUNT(d.id)::int AS deliveries,
              COALESCE(SUM(d.quantity_delivered), 0)::int AS qty_delivered,
              COALESCE(SUM(d.quantity_recovered), 0)::int AS qty_recovered,
              COALESCE(SUM(d.quantity_delivered - d.quantity_recovered), 0)::int AS total_quantity
       FROM stores s
       LEFT JOIN deliveries d
         ON d.store_id = s.id
        AND EXTRACT(YEAR  FROM d.delivery_date) = $2
        AND EXTRACT(MONTH FROM d.delivery_date) = $3
       WHERE s.user_id = $1 AND s.is_active = TRUE
       GROUP BY s.id ORDER BY total_quantity DESC`,
      [req.userId, y, m]
    );

    const grand = rows.reduce((s, r) => s + r.total_quantity, 0);
    res.json({ month: m, year: y, stores: rows, grand_total: grand });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listStores, getStore, createStore, updateStore, deleteStore,
  getMonthlySlip, getMonthlySummary,
};
