const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/config/database');
const { clearTables, registerUser, createStore, createDelivery } = require('./helpers');

let token, store;

beforeEach(async () => {
  await clearTables();
  ({ token } = await registerUser());
  ({ store } = await createStore(token, { name: 'TestShop' }));
});
afterAll(() => db.end());

describe('POST /api/deliveries', () => {
  it('creates a delivery with delivery_number = 1 for first delivery', async () => {
    const res = await request(app)
      .post('/api/deliveries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        store_id: store.id, delivery_date: '2026-03-01',
        quantity_delivered: 10, quantity_recovered: 2,
      });
    expect(res.status).toBe(201);
    expect(res.body.delivery_number).toBe(1);
    expect(res.body.total_quantity).toBe(8);
  });

  it('increments delivery_number per store', async () => {
    await createDelivery(token, store.id);
    const { res } = await createDelivery(token, store.id, { delivery_date: '2026-03-02' });
    expect(res.body.delivery_number).toBe(2);
  });

  it('returns 404 for unknown store', async () => {
    const res = await request(app)
      .post('/api/deliveries')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: 9999, delivery_date: '2026-03-01', quantity_delivered: 5 });
    expect(res.status).toBe(404);
  });

  it('validates required fields', async () => {
    const res = await request(app)
      .post('/api/deliveries')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: store.id });
    expect(res.status).toBe(400);
  });

  it('rejects negative quantity', async () => {
    const res = await request(app)
      .post('/api/deliveries')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: store.id, delivery_date: '2026-03-01', quantity_delivered: -5 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/deliveries', () => {
  beforeEach(async () => {
    await createDelivery(token, store.id, { delivery_date: '2026-03-01', quantity_delivered: 10 });
    await createDelivery(token, store.id, { delivery_date: '2026-03-15', quantity_delivered: 20 });
  });

  it('returns all deliveries', async () => {
    const res = await request(app).get('/api/deliveries').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters by date', async () => {
    const res = await request(app)
      .get('/api/deliveries?date=2026-03-01')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].quantity_delivered).toBe(10);
  });

  it('filters by store_id', async () => {
    const { store: store2 } = await createStore(token, { name: 'Shop2' });
    await createDelivery(token, store2.id, { delivery_date: '2026-03-01' });

    const res = await request(app)
      .get(`/api/deliveries?store_id=${store.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveLength(2);
  });

  it('filters by month and year', async () => {
    const res = await request(app)
      .get('/api/deliveries?month=3&year=2026')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveLength(2);
  });
});

describe('PUT /api/deliveries/:id', () => {
  it('updates delivery fields', async () => {
    const { delivery } = await createDelivery(token, store.id);
    const res = await request(app)
      .put(`/api/deliveries/${delivery.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity_delivered: 15, quantity_recovered: 3 });
    expect(res.status).toBe(200);
    expect(res.body.quantity_delivered).toBe(15);
    expect(res.body.total_quantity).toBe(12);
  });

  it('returns 404 for another user\'s delivery', async () => {
    const { delivery } = await createDelivery(token, store.id);
    const { token: other } = await registerUser({ email: 'other@x.com' });
    const res = await request(app)
      .put(`/api/deliveries/${delivery.id}`)
      .set('Authorization', `Bearer ${other}`)
      .send({ quantity_delivered: 99 });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/deliveries/:id/status', () => {
  it('changes status to ok', async () => {
    const { delivery } = await createDelivery(token, store.id);
    const res = await request(app)
      .patch(`/api/deliveries/${delivery.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ok' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('rejects invalid status', async () => {
    const { delivery } = await createDelivery(token, store.id);
    const res = await request(app)
      .patch(`/api/deliveries/${delivery.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'invalid' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/deliveries/:id', () => {
  it('deletes a delivery', async () => {
    const { delivery } = await createDelivery(token, store.id);
    const del = await request(app)
      .delete(`/api/deliveries/${delivery.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const get = await request(app)
      .get(`/api/deliveries/${delivery.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(404);
  });
});

describe('GET /api/deliveries/today', () => {
  it('returns only today\'s deliveries', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await createDelivery(token, store.id, { delivery_date: today });
    await createDelivery(token, store.id, { delivery_date: '2020-01-01' });

    const res = await request(app)
      .get('/api/deliveries/today')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].delivery_date.slice(0, 10)).toBe(today);
  });
});

describe('GET /api/deliveries/monthly-total', () => {
  it('returns correct monthly aggregates', async () => {
    await createDelivery(token, store.id, { delivery_date: '2026-03-01', quantity_delivered: 10, quantity_recovered: 2 });
    await createDelivery(token, store.id, { delivery_date: '2026-03-15', quantity_delivered: 20, quantity_recovered: 5 });

    const res = await request(app)
      .get('/api/deliveries/monthly-total?month=3&year=2026')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total_quantity).toBe(23);
    expect(res.body.deliveries).toBe(2);
  });
});
