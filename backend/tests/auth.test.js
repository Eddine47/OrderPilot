const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/config/database');
const { clearTables } = require('./helpers');

beforeEach(clearTables);
afterAll(() => db.end());

describe('POST /api/auth/register', () => {
  it('registers a new user and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'user@test.com',
      password: 'password123',
      name: 'Alice',
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ email: 'user@test.com', name: 'Alice' });
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  it('returns 409 when email is already taken', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'dup@test.com', password: 'password123', name: 'Alice',
    });
    const res = await request(app).post('/api/auth/register').send({
      email: 'dup@test.com', password: 'password456', name: 'Bob',
    });
    expect(res.status).toBe(409);
  });

  it('validates required fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({
      email: 'login@test.com', password: 'password123', name: 'Bob',
    });
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.com', password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.com', password: 'wrongpass',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 on unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@test.com', password: 'password123',
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the authenticated user', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      email: 'me@test.com', password: 'password123', name: 'Carol',
    });
    const token = regRes.body.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: 'me@test.com', name: 'Carol' });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
