process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgres://postgres:postgres@localhost:5432/profmatch_test';

const request = require('supertest');
const pool = require('../src/db/pool');
const { createSchema, seed } = require('../src/db/setup');
const { createApp } = require('../src/app');

const app = createApp();
let token;

beforeAll(async () => {
  await createSchema();
  await seed();
  const res = await request(app).post('/auth/signup')
    .send({ email: 'Tester@SJSU.edu', password: 'supersecret1', displayName: 'Tester' });
  token = res.body.token;
});
afterAll(() => pool.end());

const review = {
  courseCode: 'cs146', rating: 5, difficulty: 3, wouldTakeAgain: true,
  body: 'Clear lectures and very helpful in office hours.',
};

describe('auth', () => {
  test('signup returns a token and lowercases email', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('tester@sjsu.edu');
  });

  test('duplicate email rejected', async () => {
    const res = await request(app).post('/auth/signup')
      .send({ email: 'tester@sjsu.edu', password: 'supersecret1', displayName: 'X' });
    expect(res.status).toBe(409);
  });

  test('wrong password rejected; password is stored hashed', async () => {
    const bad = await request(app).post('/auth/login').send({ email: 'tester@sjsu.edu', password: 'nope' });
    expect(bad.status).toBe(401);
    const { rows } = await pool.query("SELECT password_hash FROM users WHERE email='tester@sjsu.edu'");
    expect(rows[0].password_hash).not.toBe('supersecret1');
    expect(rows[0].password_hash.startsWith('$2')).toBe(true);
  });

  test('login works', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'TESTER@sjsu.edu', password: 'supersecret1' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('protected route needs a valid token', async () => {
    expect((await request(app).get('/auth/me')).status).toBe(401);
    expect((await request(app).get('/auth/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
  });
});

describe('professors', () => {
  test('search is case-insensitive', async () => {
    const res = await request(app).get('/professors?q=PATEL');
    expect(res.body.professors.map((p) => p.name)).toEqual(['Dr. Maya Patel']);
    expect(res.body.professors[0].avg_rating).toBe(4.5);
    expect(res.body.professors[0].take_again_pct).toBe(100);
  });

  test('filter by department', async () => {
    const res = await request(app).get('/professors?department=Linguistics');
    expect(res.body.professors).toHaveLength(2);
  });

  test('detail includes reviews and top tags', async () => {
    const list = await request(app).get('/professors?q=patel');
    const res = await request(app).get(`/professors/${list.body.professors[0].id}`);
    expect(res.body.reviews).toHaveLength(2);
    expect(res.body.topTags.map((t) => t.tag)).toContain('Helpful');
  });

  test('unknown professor is 404', async () => {
    expect((await request(app).get('/professors/99999')).status).toBe(404);
  });
});

describe('reviews', () => {
  let profId;
  beforeAll(async () => {
    profId = (await request(app).get('/professors?q=okafor')).body.professors[0].id;
  });

  test('must be logged in to post', async () => {
    expect((await request(app).post(`/professors/${profId}/reviews`).send(review)).status).toBe(401);
  });

  test('creates review, normalizes course code, auto-tags text', async () => {
    const res = await request(app).post(`/professors/${profId}/reviews`)
      .set('Authorization', `Bearer ${token}`).send(review);
    expect(res.status).toBe(201);
    expect(res.body.review.course_code).toBe('CS 146');
    expect(res.body.review.tags).toEqual(expect.arrayContaining(['Clear lectures', 'Helpful']));
  });

  test('duplicate review is blocked', async () => {
    const res = await request(app).post(`/professors/${profId}/reviews`)
      .set('Authorization', `Bearer ${token}`).send(review);
    expect(res.status).toBe(409);
  });

  test('invalid rating rejected', async () => {
    const res = await request(app).post(`/professors/${profId}/reviews`)
      .set('Authorization', `Bearer ${token}`).send({ ...review, rating: 9 });
    expect(res.status).toBe(400);
  });

  test('edit then delete my review', async () => {
    const put = await request(app).put(`/professors/${profId}/reviews/mine`)
      .set('Authorization', `Bearer ${token}`).send({ ...review, rating: 3, body: 'Disorganized and confusing lectures.' });
    expect(put.body.review.rating).toBe(3);
    expect(put.body.review.tags).toContain('Confusing lectures');
    const del = await request(app).delete(`/professors/${profId}/reviews/mine`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);
  });
});
