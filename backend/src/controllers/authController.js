const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db      = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, name, company_name, company_address, company_siret } = req.body;

    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { rows: [user] } = await db.query(
      `INSERT INTO users (email, password_hash, name, company_name, company_address, company_siret)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, company_name, company_address, company_siret, created_at`,
      [email.toLowerCase(), password_hash, name,
       company_name || 'Ma Société', company_address || null, company_siret || null]
    );

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    const { rows: [user] } = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const { password_hash: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const { rows: [user] } = await db.query(
      `SELECT id, email, name, company_name, company_address, company_siret, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, company_name, company_address, company_siret, email, current_password, new_password } = req.body;

    // Changement d'email ou de mot de passe : vérifier le mot de passe actuel
    if (email || new_password) {
      const { rows: [existing] } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
      if (!existing) return res.status(404).json({ error: 'Utilisateur introuvable' });

      const valid = await bcrypt.compare(current_password || '', existing.password_hash);
      if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

      if (email) {
        const { rows: taken } = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase(), req.userId]);
        if (taken.length > 0) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
      }
    }

    const newHash = new_password ? await bcrypt.hash(new_password, 12) : null;

    const { rows: [user] } = await db.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           company_name = COALESCE($2, company_name),
           company_address = COALESCE($3, company_address),
           company_siret = COALESCE($4, company_siret),
           email = COALESCE($5, email),
           password_hash = COALESCE($6, password_hash)
       WHERE id = $7
       RETURNING id, email, name, company_name, company_address, company_siret`,
      [name || null, company_name || null, company_address ?? null, company_siret ?? null,
       email ? email.toLowerCase() : null, newHash, req.userId]
    );
    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me, updateProfile };
