// Creates the tables and (optionally) fills them with demo data.
// Usage: node src/db/setup.js [--seed]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./pool');
const { extractTags } = require('../feedback');

async function createSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

const DEMO = {
  'Computer Science': ['Dr. Maya Patel', 'Dr. James Chen', 'Prof. Laura Kim'],
  Linguistics: ['Dr. Elena Rossi', 'Prof. David Okafor'],
  Mathematics: ['Dr. Sarah Nguyen', 'Prof. Michael Brooks'],
  Psychology: ['Dr. Priya Sharma'],
};

const DEMO_REVIEWS = [
  ['Dr. Maya Patel', 'CS 146', 5, 4, true, 'Lectures are super clear and she gives great examples. Exams are hard but fair, study the homework.'],
  ['Dr. Maya Patel', 'CS 146', 4, 4, true, 'Tough grader on projects but you learn a ton. Very helpful in office hours.'],
  ['Dr. James Chen', 'CS 151', 2, 3, false, 'Lectures are disorganized and hard to follow. Lots of busywork and the grading is unclear.'],
  ['Prof. Laura Kim', 'CS 157A', 5, 2, true, 'Easy A if you show up. Clear slides, caring professor, and she posts recordings online.'],
  ['Dr. Elena Rossi', 'LING 114', 5, 3, true, 'Amazing semantics class. Engaging lectures and she really cares about students.'],
  ['Dr. Sarah Nguyen', 'MATH 42', 3, 5, false, 'Very hard exams and a heavy workload. Fair grading though, and helpful when you email.'],
];

async function seed() {
  await pool.query('TRUNCATE reviews, professors, departments, users RESTART IDENTITY CASCADE');
  const profIds = {};
  for (const [dept, profs] of Object.entries(DEMO)) {
    const { rows } = await pool.query('INSERT INTO departments (name) VALUES ($1) RETURNING id', [dept]);
    for (const name of profs) {
      const r = await pool.query(
        'INSERT INTO professors (name, department_id) VALUES ($1, $2) RETURNING id', [name, rows[0].id]);
      profIds[name] = r.rows[0].id;
    }
  }
  const hash = await bcrypt.hash('password123', 10);
  for (let i = 0; i < DEMO_REVIEWS.length; i++) {
    const u = await pool.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
      [`demo${i + 1}@sjsu.edu`, hash, `Student ${i + 1}`]);
    const [prof, course, rating, diff, again, body] = DEMO_REVIEWS[i];
    await pool.query(
      `INSERT INTO reviews (professor_id, user_id, course_code, rating, difficulty, would_take_again, body, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [profIds[prof], u.rows[0].id, course, rating, diff, again, body, extractTags(body)]);
  }
}

if (require.main === module) {
  (async () => {
    await createSchema();
    if (process.argv.includes('--seed')) await seed();
    console.log('Database ready' + (process.argv.includes('--seed') ? ' (with demo data)' : ''));
    await pool.end();
  })().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { createSchema, seed };
