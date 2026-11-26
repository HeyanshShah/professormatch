// Tiny migration runner: applies src/db/migrations/NNN_name.sql files in order,
// each inside a transaction, and records them in schema_migrations so each runs once.
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const DIR = path.join(__dirname, 'migrations');

async function migrate({ log = console.log } = {}) {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const done = new Set((await pool.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version));
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(DIR, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await client.query('COMMIT');
      log(`applied ${file}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error(`migration ${file} failed: ${e.message}`);
    } finally {
      client.release();
    }
  }
}

async function reset() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}

if (require.main === module) {
  require('dotenv').config();
  migrate().then(() => pool.end()).catch((e) => { console.error(e.message); process.exit(1); });
}

module.exports = { migrate, reset };
