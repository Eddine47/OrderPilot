const { validationResult } = require('express-validator');
const db = require('../config/database');

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
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function createSale(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { sale_date, quantity, payment_method, notes } = req.body;

    const { rows: [s] } = await db.query(
      `INSERT INTO private_sales (user_id, sale_date, quantity, payment_method, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId, sale_date, quantity, payment_method, notes || null]
    );
    res.status(201).json(s);
  } catch (err) {
    next(err);
  }
}

async function updateSale(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { sale_date, quantity, payment_method, notes } = req.body;

    const { rows: [s] } = await db.query(
      `UPDATE private_sales
       SET sale_date      = COALESCE($1, sale_date),
           quantity       = COALESCE($2, quantity),
           payment_method = COALESCE($3, payment_method),
           notes          = COALESCE($4, notes)
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [sale_date, quantity, payment_method, notes, req.params.id, req.userId]
    );
    if (!s) return res.status(404).json({ error: 'Vente introuvable' });
    res.json(s);
  } catch (err) {
    next(err);
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
