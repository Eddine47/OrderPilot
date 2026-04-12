const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/config/database');
const { clearTables, registerUser, createStore } = require('./helpers');
const { generateRecurringForToday } = require('../src/services/recurringService');

let token, store;

beforeEach(async () => {
  await clearTables();
  ({ token } = await registerUser());
  ({ store } = await createStore(token, { name: 'Marché' }));
});
afterAll(() => db.end());

describe('POST /api/recurring', () => {
  it('creates a recurring rule', async () => {
    const res = await request(app)
      .post('/api/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: store.id, day_of_week: 1, quantity: 10 });
    expect(res.status).toBe(201);
    expect(res.body.day_of_week).toBe(1);
    expect(res.body.quantity).toBe(10);
  });

  it('validates day_of_week range', async () => {
    const res = await request(app)
      .post('/api/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: store.id, day_of_week: 7, quantity: 10 });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown store', async () => {
    const res = await request(app)
      .post('/api/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: 9999, day_of_week: 1, quantity: 10 });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/recurring', () => {
  it('lists rules with store name', async () => {
    await request(app)
      .post('/api/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: store.id, day_of_week: 2, quantity: 15 });
    const res = await request(app)
      .get('/api/recurring')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body[0].store_name).toBe('Marché');
  });
});

describe('PUT /api/recurring/:id', () => {
  it('updates quantity and active status', async () => {
    const cr = await request(app)
      .post('/api/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: store.id, day_of_week: 3, quantity: 5 });
    const id = cr.body.id;

    const res = await request(app)
      .put(`/api/recurring/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 20, is_active: false });
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(20);
    expect(res.body.is_active).toBe(false);
  });
});

describe('DELETE /api/recurring/:id', () => {
  it('deletes a rule', async () => {
    const cr = await request(app)
      .post('/api/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: store.id, day_of_week: 4, quantity: 8 });
    const id = cr.body.id;

    const del = await request(app)
      .delete(`/api/recurring/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const list = await request(app)
      .get('/api/recurring')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(0);
  });
});

describe('generateRecurringForToday service', () => {
  it('creates a delivery when the rule matches today\'s day', async () => {
    // Use a fixed date (Wednesday = day 3) so the test is deterministic
    const testDate = '2026-03-04'; // Wednesday

    await request(app)
      .post('/api/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: store.id, day_of_week: 3, quantity: 12 });

    const created = await generateRecurringForToday(testDate);
    expect(created).toBe(1);

    // Calling again the same day should NOT create a duplicate
    const createdAgain = await generateRecurringForToday(testDate);
    expect(createdAgain).toBe(0);
  });

  it('does not create deliveries for inactive rules', async () => {
    const cr = await request(app)
      .post('/api/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: store.id, day_of_week: 3, quantity: 8 });

    await request(app)
      .put(`/api/recurring/${cr.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    const created = await generateRecurringForToday('2026-03-04');
    expect(created).toBe(0);
  });
});

describe('POST /api/recurring/generate', () => {
  it('triggers generation via API', async () => {
    const testDate = '2026-03-06'; // Friday = day 5
    await request(app)
      .post('/api/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: store.id, day_of_week: 5, quantity: 7 });

    const res = await request(app)
      .post('/api/recurring/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: testDate });
    expect(res.status).toBe(200);
    expect(res.body.created).toBeGreaterThanOrEqual(1);
  });
});
