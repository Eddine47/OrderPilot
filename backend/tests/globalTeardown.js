const { Client } = require('pg');
require('dotenv').config();

module.exports = async function globalTeardown() {
  const client = new Client({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    database: 'postgres',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  await client.connect();
  const dbName = process.env.DB_TEST_NAME || 'livraison_test';
  await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
  await client.end();
};
