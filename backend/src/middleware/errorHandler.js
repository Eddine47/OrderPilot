const isProd = process.env.NODE_ENV === 'production';

function errorHandler(err, req, res, _next) {
  // Toujours logguer en interne
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err);

  const status = err.status || 500;

  // En production : ne jamais exposer les détails techniques
  const message = isProd && status === 500
    ? 'Erreur serveur interne'
    : (err.message || 'Erreur serveur interne');

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
