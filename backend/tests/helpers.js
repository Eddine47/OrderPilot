const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/config/database');

async function clearTables() {
  await db.query('DELETE FROM recurring_deliveries');
  await db.query('DELETE FROM deliveries');
  await db.query('DELETE FROM stores');
  await db.query('DELETE FROM users');
}

async function registerUser(overrides = {}) {
  const payload = {
    email:        'test@example.com',
    password:     'password123',
    name:         'Test User',
    company_name: 'Test Corp',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(payload);
  return { token: res.body.token, user: res.body.user, res };
}

async function createStore(token, overrides = {}) {
  const payload = { name: 'Enseigne Test', ...overrides };
  const res = await request(app)
    .post('/api/stores')
    .set('Authorization', `Bearer ${token}`)
    .send(payload);
  return { store: res.body, res };
}

async function createDelivery(token, storeId, overrides = {}) {
  const payload = {
    store_id:           storeId,
    delivery_date:      '2026-03-01',
    quantity_delivered: 10,
    quantity_recovered: 0,
    ...overrides,
  };
  const res = await request(app)
    .post('/api/deliveries')
    .set('Authorization', `Bearer ${token}`)
    .send(payload);
  return { delivery: res.body, res };
}

module.exports = { clearTables, registerUser, createStore, createDelivery };
