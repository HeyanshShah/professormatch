// One shared connection pool to PostgreSQL. A pool reuses connections
// instead of opening a new one for every request (much faster).
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/profmatch',
  // Hosted databases (Render, Neon, Supabase) require TLS.
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

module.exports = pool;
