const { validationResult } = require('express-validator');
const db = require('../config/database');
const { generateRecurringForMonth } = require('../services/recurringService');

async function listRules(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT r.*, s.name AS store_name
       FROM recurring_deliveries r
       JOIN stores s ON s.id = r.store_id
       WHERE r.user_id = $1
       ORDER BY s.name, r.day_of_month`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function createRule(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { store_id, day_of_month, quantity } = req.body;

    // Verify ownership
    const { rows: [store] } = await db.query(
      'SELECT id FROM stores WHERE id = $1 AND user_id = $2 AND is_active = TRUE',
      [store_id, req.userId]
    );
    if (!store) return res.status(404).json({ error: 'Enseigne introuvable' });

    const { rows: [rule] } = await db.query(
      `INSERT INTO recurring_deliveries (user_id, store_id, day_of_month, quantity)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.userId, store_id, day_of_month, quantity]
    );
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
}

async function updateRule(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { day_of_month, quantity, is_active } = req.body;
    const { rows: [rule] } = await db.query(
      `UPDATE recurring_deliveries
       SET day_of_month = COALESCE($1, day_of_month),
           quantity     = COALESCE($2, quantity),
           is_active    = COALESCE($3, is_active)
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [day_of_month, quantity, is_active, req.params.id, req.userId]
    );
    if (!rule) return res.status(404).json({ error: 'Règle introuvable' });
    res.json(rule);
  } catch (err) {
    next(err);
  }
}

async function deleteRule(req, res, next) {
  try {
    const { rows: [rule] } = await db.query(
      'DELETE FROM recurring_deliveries WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (!rule) return res.status(404).json({ error: 'Règle introuvable' });
    res.json({ message: 'Règle supprimée' });
  } catch (err) {
    next(err);
  }
}

async function generate(req, res, next) {
  try {
    const { month, year } = req.body;
    const m = month || new Date().getMonth() + 1;
    const y = year  || new Date().getFullYear();
    const created = await generateRecurringForMonth(req.userId, m, y);
    res.json({ message: `${created} livraison(s) créée(s)`, created });
  } catch (err) {
    next(err);
  }
}

module.exports = { listRules, createRule, updateRule, deleteRule, generate };
