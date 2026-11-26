process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgres://postgres:postgres@localhost:5432/profmatch_test';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const pool = require('../src/db/pool');
const { setup } = require('../src/db/setup');
const { migrate, reset } = require('../src/db/migrate');
const { createApp } = require('../src/app');

const app = createApp();
const auth = (t) => ({ Authorization: `Bearer ${t}` });
let token;
let token2;

async function signup(email) {
  const res = await request(app).post('/auth/signup').send({ email, password: 'supersecret1', displayName: email.split('@')[0] });
  return res.body.token;
}
async function login(email) {
  return (await request(app).post('/auth/login').send({ email, password: 'password123' })).body.token;
}
const profId = async (q) => (await request(app).get(`/professors?q=${q}`)).body.professors[0].id;
const review = { courseCode: 'cs146', rating: 5, difficulty: 3, wouldTakeAgain: true,
  body: 'Clear lectures and very helpful in office hours.' };

beforeAll(async () => {
  await setup({ seed: true, fresh: true });
  token = await signup('Tester@SJSU.edu');
  token2 = await signup('second@sjsu.edu');
});
afterAll(() => pool.end());

describe('migrations', () => {
  test('v1 data is carried into v2 courses table', async () => {
    // Build a throwaway schema at v1, insert v1-style data, then run the v2 migration.
    const client = await pool.connect();
    try {
      await client.query('DROP SCHEMA IF EXISTS mtest CASCADE; CREATE SCHEMA mtest; SET search_path TO mtest');
      await client.query(fs.readFileSync(path.join(__dirname, '../src/db/migrations/001_init.sql'), 'utf8'));
      await client.query(`INSERT INTO users (email, password_hash, display_name) VALUES ('a@b.c','x','A');
        INSERT INTO departments (name) VALUES ('CS'); INSERT INTO professors (name, department_id) VALUES ('P', 1);
        INSERT INTO reviews (professor_id, user_id, course_code, rating, difficulty, would_take_again, body)
        VALUES (1, 1, 'CS 146', 5, 3, true, 'Great class overall.')`);
      await client.query(fs.readFileSync(path.join(__dirname, '../src/db/migrations/002_courses_votes_moderation.sql'), 'utf8'));
      const { rows } = await client.query('SELECT c.code FROM reviews r JOIN courses c ON c.id = r.course_id');
      expect(rows[0].code).toBe('CS 146');
      const pc = await client.query('SELECT COUNT(*)::int AS n FROM professor_courses');
      expect(pc.rows[0].n).toBe(1);
    } finally {
      await client.query('SET search_path TO public; DROP SCHEMA mtest CASCADE');
      client.release();
    }
  });

  test('running migrations twice is a no-op', async () => {
    await migrate({ log: () => {} });
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM schema_migrations');
    expect(rows[0].n).toBe(2);
  });
});

describe('auth', () => {
  test('signup lowercases email; password stored as bcrypt hash', async () => {
    const me = await request(app).get('/auth/me').set(auth(token));
    expect(me.body.user.email).toBe('tester@sjsu.edu');
    const { rows } = await pool.query("SELECT password_hash FROM users WHERE email='tester@sjsu.edu'");
    expect(rows[0].password_hash.startsWith('$2')).toBe(true);
  });
  test('duplicate email and wrong password rejected', async () => {
    expect((await request(app).post('/auth/signup').send({ email: 'tester@sjsu.edu', password: 'supersecret1', displayName: 'X' })).status).toBe(409);
    expect((await request(app).post('/auth/login').send({ email: 'tester@sjsu.edu', password: 'nope' })).status).toBe(401);
  });
  test('protected routes need a valid token', async () => {
    expect((await request(app).get('/auth/me')).status).toBe(401);
    expect((await request(app).get('/auth/me').set(auth('garbage'))).status).toBe(401);
  });
  test('security headers are set', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('ranking & search', () => {
  test('Bayesian ranking: a professor with one review is not ranked #1', async () => {
    const { body } = await request(app).get('/professors?sort=best');
    const green = body.professors.find((p) => p.name === 'Dr. Rachel Green');
    expect(green.review_count).toBe(1);
    expect(green.bayes_rating).toBeLessThan(green.avg_rating);
    expect(body.professors[0].review_count).toBeGreaterThan(1);
    const scores = body.professors.map((p) => p.bayes_rating);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
  test('search by name, department, and course', async () => {
    expect((await request(app).get('/professors?q=PATEL')).body.professors.map((p) => p.name)).toEqual(['Dr. Maya Patel']);
    expect((await request(app).get('/professors?department=Linguistics')).body.professors).toHaveLength(2);
    const cs146 = (await request(app).get('/professors?course=cs-146')).body.professors.map((p) => p.name);
    expect(cs146).toEqual(expect.arrayContaining(['Dr. Maya Patel', 'Dr. Omar Haddad', 'Dr. Rachel Green']));
  });
  test('course search', async () => {
    const { body } = await request(app).get('/courses?q=ling');
    expect(body.courses.map((c) => c.code)).toEqual(expect.arrayContaining(['LING 114', 'LING 122']));
  });
});

describe('recommendations', () => {
  test('easy vs challenging give different #1 picks with explanations', async () => {
    const easy = (await request(app).get('/courses/CS146/recommendations?preference=easy')).body.recommendations;
    const hard = (await request(app).get('/courses/CS146/recommendations?preference=challenging')).body.recommendations;
    expect(easy[0].name).not.toBe(hard[0].name);
    expect(easy[0]).toHaveProperty('why.ease');
    expect(hard[0]).toHaveProperty('why.rigor');
  });
  test('bad preference 400, unknown course 404', async () => {
    expect((await request(app).get('/courses/CS146/recommendations?preference=lazy')).status).toBe(400);
    expect((await request(app).get('/courses/ART999/recommendations')).status).toBe(404);
  });
});

describe('reviews', () => {
  let pid;
  beforeAll(async () => { pid = await profId('okafor'); });

  test('creates review: normalizes course, tags text, scores sentiment, links course', async () => {
    const res = await request(app).post(`/professors/${pid}/reviews`).set(auth(token)).send(review);
    expect(res.status).toBe(201);
    expect(res.body.review.course_code).toBe('CS 146');
    expect(res.body.review.tags).toEqual(expect.arrayContaining(['Clear lectures', 'Helpful']));
    expect(res.body.review.sentiment).toBeGreaterThan(0.5);
    const prof = (await request(app).get(`/professors/${pid}`).set(auth(token))).body;
    expect(prof.courses).toContain('CS 146');
    expect(prof.myReview.course_code).toBe('CS 146');
  });
  test('duplicate review blocked (409), anonymous blocked (401)', async () => {
    expect((await request(app).post(`/professors/${pid}/reviews`).set(auth(token)).send(review)).status).toBe(409);
    expect((await request(app).post(`/professors/${pid}/reviews`).send(review)).status).toBe(401);
  });
  test('moderation rejects profanity and personal info before saving', async () => {
    const pid2 = await profId('patel');
    const bad = await request(app).post(`/professors/${pid2}/reviews`).set(auth(token2)).send({ ...review, body: 'This guy is a total 1diot honestly.' });
    expect(bad.status).toBe(422);
    expect(bad.body.reasons).toContain('offensive language');
    const pii = await request(app).post(`/professors/${pid2}/reviews`).set(auth(token2)).send({ ...review, body: 'Text him at 408-555-1234 for answers.' });
    expect(pii.body.reasons).toContain('personal contact information');
  });
  test('invalid input rejected', async () => {
    expect((await request(app).post(`/professors/${pid}/reviews`).set(auth(token2)).send({ ...review, rating: 9 })).status).toBe(400);
    expect((await request(app).post(`/professors/${pid}/reviews`).set(auth(token2)).send({ ...review, courseCode: 'hello' })).status).toBe(400);
  });
  test('edit then delete my review', async () => {
    const put = await request(app).put(`/professors/${pid}/reviews/mine`).set(auth(token))
      .send({ ...review, rating: 2, body: 'Disorganized and confusing lectures.' });
    expect(put.body.review.tags).toContain('Confusing lectures');
    expect(put.body.review.sentiment).toBeLessThan(0);
    expect((await request(app).delete(`/professors/${pid}/reviews/mine`).set(auth(token))).status).toBe(204);
  });
});

describe('cursor pagination', () => {
  test('pages through every review exactly once', async () => {
    const pid = await profId('brooks');
    const total = (await request(app).get(`/professors/${pid}`)).body.professor.review_count;
    const seen = [];
    let cursor = '';
    for (let i = 0; i < 20; i += 1) {
      const { body } = await request(app).get(`/professors/${pid}/reviews?limit=3${cursor ? `&cursor=${cursor}` : ''}`);
      seen.push(...body.reviews.map((r) => r.id));
      if (!body.nextCursor) break;
      cursor = body.nextCursor;
    }
    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
  });
});

describe('helpful votes', () => {
  test('toggle on/off, one per user, not on your own review', async () => {
    const pid = await profId('kim');
    const rid = (await request(app).get(`/professors/${pid}`)).body.reviews[0].id;
    const before = (await pool.query('SELECT helpful_count FROM reviews WHERE id=$1', [rid])).rows[0].helpful_count;
    const on = await request(app).post(`/reviews/${rid}/helpful`).set(auth(token));
    expect(on.body).toEqual({ voted: true, helpfulCount: expect.any(Number) });
    const off = await request(app).post(`/reviews/${rid}/helpful`).set(auth(token));
    expect(off.body.voted).toBe(false);
    expect(off.body.helpfulCount).toBe(0 + (on.body.helpfulCount - 1));
    expect(before).toBeGreaterThanOrEqual(0);
    const own = await request(app).post(`/professors/${pid}/reviews`).set(auth(token2)).send(review);
    expect((await request(app).post(`/reviews/${own.body.review.id}/helpful`).set(auth(token2))).status).toBe(400);
  });
});

describe('reports & moderation', () => {
  test('3 reports hide a review; moderator can see and restore it', async () => {
    const pid = await profId('alvarez');
    const target = (await request(app).get(`/professors/${pid}`)).body.reviews[0];
    const reporters = [token, token2, await signup('third@sjsu.edu')];
    const results = [];
    for (const t of reporters) {
      results.push((await request(app).post(`/reviews/${target.id}/report`).set(auth(t)).send({ reason: 'offensive' })).body);
    }
    expect(results.map((r) => r.hidden)).toEqual([false, false, true]);
    expect((await request(app).post(`/reviews/${target.id}/report`).set(auth(token)).send({ reason: 'spam' })).status).toBe(409);
    const visible = (await request(app).get(`/professors/${pid}`)).body.reviews.map((r) => r.id);
    expect(visible).not.toContain(target.id);

    expect((await request(app).get('/moderation/queue').set(auth(token))).status).toBe(403);
    const mod = await login('mod@sjsu.edu');
    const queue = (await request(app).get('/moderation/queue').set(auth(mod))).body.queue;
    expect(queue.find((q) => q.id === target.id).reports).toBe(3);
    await request(app).post(`/moderation/reviews/${target.id}`).set(auth(mod)).send({ action: 'restore' });
    const after = (await request(app).get(`/professors/${pid}`)).body.reviews.map((r) => r.id);
    expect(after).toContain(target.id);
  });
});
