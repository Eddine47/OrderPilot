require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const { errorHandler } = require('./middleware/errorHandler');
const authRoutes        = require('./routes/auth');
const storeRoutes       = require('./routes/stores');
const deliveryRoutes    = require('./routes/deliveries');
const recurringRoutes   = require('./routes/recurring');

const app = express();

// ── Sécurité : headers HTTP ────────────────────────────────────────────────
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Body parser (limite 50kb pour éviter les payloads géants) ──────────────
app.use(express.json({ limit: '50kb' }));

// ── Rate limiting sur les routes d'authentification ───────────────────────
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             20,              // 20 tentatives max par IP
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Trop de tentatives, réessayez dans 15 minutes.' },
});

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',       authLimiter, authRoutes);
app.use('/api/stores',     storeRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/recurring',  recurringRoutes);

// ── 404 ────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route introuvable' }));

// ── Gestionnaire d'erreurs ─────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
