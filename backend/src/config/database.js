require('dotenv').config();
const { Pool } = require('pg');

const isTest = process.env.NODE_ENV === 'test';

// Railway fournit DATABASE_URL automatiquement quand on lie le service PostgreSQL.
// En local / Docker, on utilise les variables individuelles.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
      max: 20,
    })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432', 10),
      database: isTest
        ? (process.env.DB_TEST_NAME || 'livraison_test')
        : (process.env.DB_NAME     || 'livraison'),
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: isTest ? 5 : 20,
    });

pool.on('error', (err) => {
  console.error('Unexpected DB pool error', err);
});

module.exports = pool;
