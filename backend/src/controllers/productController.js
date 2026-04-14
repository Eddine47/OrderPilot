const { validationResult } = require('express-validator');
const db = require('../config/database');

async function listProducts(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM products
       WHERE user_id = $1 AND is_active = TRUE
       ORDER BY name ASC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getProduct(req, res, next) {
  try {
    const { rows: [p] } = await db.query(
      'SELECT * FROM products WHERE id = $1 AND user_id = $2 AND is_active = TRUE',
      [req.params.id, req.userId]
    );
    if (!p) return res.status(404).json({ error: 'Produit introuvable' });
    res.json(p);
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, unit, unit_price_ht, vat_rate } = req.body;
    const { rows: [p] } = await db.query(
      `INSERT INTO products (user_id, name, unit, unit_price_ht, vat_rate)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId, name, unit || 'unité', unit_price_ht ?? 0, vat_rate ?? 20]
    );
    res.status(201).json(p);
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, unit, unit_price_ht, vat_rate } = req.body;
    const { rows: [p] } = await db.query(
      `UPDATE products
       SET name          = COALESCE($1, name),
           unit          = COALESCE($2, unit),
           unit_price_ht = COALESCE($3, unit_price_ht),
           vat_rate      = COALESCE($4, vat_rate)
       WHERE id = $5 AND user_id = $6 AND is_active = TRUE
       RETURNING *`,
      [name, unit, unit_price_ht, vat_rate, req.params.id, req.userId]
    );
    if (!p) return res.status(404).json({ error: 'Produit introuvable' });
    res.json(p);
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const { rows: [p] } = await db.query(
      `UPDATE products SET is_active = FALSE
       WHERE id = $1 AND user_id = $2 AND is_active = TRUE
       RETURNING id`,
      [req.params.id, req.userId]
    );
    if (!p) return res.status(404).json({ error: 'Produit introuvable' });
    res.json({ message: 'Produit supprimé' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct };
