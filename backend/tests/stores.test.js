const request  = require('supertest');
const app      = require('../src/app');
const db       = require('../src/config/database');
const { clearTables, registerUser, createStore } = require('./helpers');

let token;

beforeEach(async () => {
  await clearTables();
  ({ token } = await registerUser());
});
afterAll(() => db.end());

describe('GET /api/stores', () => {
  it('returns empty list initially', async () => {
    const res = await request(app).get('/api/stores').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('lists created stores', async () => {
    await createStore(token, { name: 'Marché Central' });
    const res = await request(app).get('/api/stores').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Marché Central');
  });

  it('supports search filter', async () => {
    await createStore(token, { name: 'Aldi' });
    await createStore(token, { name: 'Leclerc' });
    const res = await request(app)
      .get('/api/stores?search=ald')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Aldi');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/stores');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/stores', () => {
  it('creates a store', async () => {
    const res = await request(app)
      .post('/api/stores')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Super U', address: '1 rue de la Paix' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Super U');
    expect(res.body.address).toBe('1 rue de la Paix');
  });

  it('validates required name', async () => {
    const res = await request(app)
      .post('/api/stores')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: 'somewhere' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/stores/:id', () => {
  it('updates a store', async () => {
    const { store } = await createStore(token, { name: 'Old Name' });
    const res = await request(app)
      .put(`/api/stores/${store.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('returns 404 for another user\'s store', async () => {
    const { store } = await createStore(token);
    const { token: otherToken } = await registerUser({ email: 'other@test.com' });
    const res = await request(app)
      .put(`/api/stores/${store.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Hack' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/stores/:id', () => {
  it('soft-deletes a store', async () => {
    const { store } = await createStore(token);
    const del = await request(app)
      .delete(`/api/stores/${store.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const list = await request(app).get('/api/stores').set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(0);
  });
});

describe('GET /api/stores/summary', () => {
  it('returns monthly summary', async () => {
    const { store } = await createStore(token, { name: 'Intermarché' });
    await request(app)
      .post('/api/deliveries')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: store.id, delivery_date: '2026-03-15', quantity_delivered: 20, quantity_recovered: 3 });

    const res = await request(app)
      .get('/api/stores/summary?month=3&year=2026')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.grand_total).toBe(17);
  });
});
