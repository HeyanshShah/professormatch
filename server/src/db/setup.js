// Applies migrations and (optionally) loads demo data.
// Usage: node src/db/setup.js [--seed] [--reset]
//
// Demo data is generated, clearly fake, and deterministic (seeded random numbers), so
// rankings and recommendations have something to work with before real students sign up.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');
const { migrate, reset } = require('./migrate');
const { extractTags } = require('../text/tags');
const { sentiment } = require('../text/sentiment');

// Small deterministic PRNG (mulberry32) so every seed run produces identical data.
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// name, department, true quality (1-5), true difficulty (1-5), courses
const PROFESSORS = [
  ['Dr. Maya Patel', 'Computer Science', 4.6, 4.2, ['CS 146', 'CS 151']],
  ['Dr. James Chen', 'Computer Science', 2.4, 3.4, ['CS 151', 'CS 157A']],
  ['Prof. Laura Kim', 'Computer Science', 4.4, 2.2, ['CS 157A', 'CS 46B']],
  ['Dr. Omar Haddad', 'Computer Science', 3.6, 3.0, ['CS 146', 'CS 46B']],
  ['Dr. Rachel Green', 'Computer Science', 4.9, 4.7, ['CS 146']],
  ['Dr. Elena Rossi', 'Linguistics', 4.7, 3.0, ['LING 114', 'LING 122']],
  ['Prof. David Okafor', 'Linguistics', 3.8, 2.4, ['LING 122', 'LING 20']],
  ['Dr. Sarah Nguyen', 'Mathematics', 3.1, 4.6, ['MATH 42', 'MATH 30']],
  ['Prof. Michael Brooks', 'Mathematics', 4.2, 2.8, ['MATH 42', 'MATH 30']],
  ['Dr. Priya Sharma', 'Psychology', 4.0, 2.0, ['PSYC 1']],
  ['Dr. Tom Alvarez', 'Psychology', 2.0, 2.5, ['PSYC 1']],
];

const PHRASES = {
  5: ['Amazing professor, lectures are super clear and engaging.', 'Best class I have taken. Really cares about students.',
    'Explains well with great examples and is very helpful in office hours.', 'Inspiring and passionate, I learned a ton.'],
  4: ['Good professor, clear lectures and fair grading.', 'Helpful and organized, would recommend.',
    'Interesting class and responsive to emails.', 'Lectures are well organized and easy to follow.'],
  3: ['Decent class. Some lectures are confusing but the grading is fair.', 'Okay professor, nothing special.',
    'Lectures are fine but a lot of work.', 'Not bad, but the slides are unclear sometimes.'],
  2: ['Lectures are disorganized and hard to follow.', 'Unclear grading and lots of busywork.',
    'Not very helpful in office hours and the exams felt unfair.', 'Boring lectures, I taught myself most of it.'],
  1: ['Terrible class, avoid if you can.', 'Confusing lectures and rude when you ask questions.',
    'Worst class I have taken, harsh and unfair grading.', 'Useless lectures, total waste of time.'],
};
const DIFFICULTY_PHRASES = { 5: ' Very hard exams and a heavy workload.', 4: ' Tough grader, study the homework.',
  2: ' Easy class if you show up.', 1: ' Easy A.' };

const clamp = (x) => Math.max(1, Math.min(5, Math.round(x)));

async function seed() {
  const r = rng(2026);
  const gauss = () => (r() + r() + r() - 1.5) * 1.4; // rough normal(0, ~0.7)
  const hash = await bcrypt.hash('password123', 10);
  const depts = {};
  for (const d of [...new Set(PROFESSORS.map((p) => p[1]))]) {
    depts[d] = (await pool.query('INSERT INTO departments (name) VALUES ($1) RETURNING id', [d])).rows[0].id;
  }
  const users = [];
  for (let i = 1; i <= 45; i += 1) {
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1,$2,$3) RETURNING id',
      [`demo${i}@sjsu.edu`, hash, `Student ${i}`]);
    users.push(rows[0].id);
  }
  await pool.query(`INSERT INTO users (email, password_hash, display_name, role)
                    VALUES ('mod@sjsu.edu', $1, 'Moderator', 'moderator')`, [hash]);
  for (const [name, dept, quality, difficulty, courses] of PROFESSORS) {
    const pid = (await pool.query('INSERT INTO professors (name, department_id) VALUES ($1,$2) RETURNING id',
      [name, depts[dept]])).rows[0].id;
    const courseIds = [];
    for (const code of courses) {
      const cid = (await pool.query(
        `INSERT INTO courses (code, department_id) VALUES ($1,$2)
         ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code RETURNING id`, [code, depts[dept]])).rows[0].id;
      await pool.query('INSERT INTO professor_courses VALUES ($1,$2) ON CONFLICT DO NOTHING', [pid, cid]);
      courseIds.push(cid);
    }
    const n = name === 'Dr. Rachel Green' ? 1 : 3 + Math.floor(r() * 9); // one "new" prof with 1 review
    const reviewers = [...users].sort(() => r() - 0.5).slice(0, n);
    for (const uid of reviewers) {
      const rating = clamp(quality + gauss());
      const diff = clamp(difficulty + gauss() * 0.7);
      const pick = PHRASES[rating];
      let body = pick[Math.floor(r() * pick.length)] + (DIFFICULTY_PHRASES[diff] || '');
      body = `${body}`;
      const daysAgo = Math.floor(r() * 300);
      await pool.query(
        `INSERT INTO reviews (professor_id, user_id, course_id, rating, difficulty, would_take_again,
                              body, tags, sentiment, created_at, helpful_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() - ($10 || ' days')::interval, $11)`,
        [pid, uid, courseIds[Math.floor(r() * courseIds.length)], rating, diff, rating >= 3 && r() > 0.15,
          body, extractTags(body), sentiment(body), daysAgo, Math.floor(r() * 12)]);
    }
  }
}

async function setup({ seed: doSeed = false, fresh = false } = {}) {
  if (fresh) await reset();
  await migrate({ log: () => {} });
  if (doSeed) {
    await pool.query(`TRUNCATE review_votes, review_reports, reviews, professor_courses, courses,
                      professors, departments, users RESTART IDENTITY CASCADE`);
    await seed();
  }
}

if (require.main === module) {
  const args = process.argv;
  setup({ seed: args.includes('--seed'), fresh: args.includes('--reset') })
    .then(() => { console.log(`Database ready${args.includes('--seed') ? ' (with demo data)' : ''}`); return pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { setup, seed };
