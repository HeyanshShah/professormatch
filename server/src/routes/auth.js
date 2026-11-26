const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const { signToken, requireAuth } = require('../auth');
const { validateSignup } = require('../validate');

const router = express.Router();

// Slow down password guessing: max 20 login/signup attempts per 15 min per IP.
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true,
  legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test' });

const publicUser = (u) => ({ id: u.id, email: u.email, displayName: u.display_name });

router.post('/signup', limiter, async (req, res, next) => {
  try {
    const error = validateSignup(req.body);
    if (error) return res.status(400).json({ error });
    const email = req.body.email.trim().toLowerCase();
    const hash = await bcrypt.hash(req.body.password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3)
       RETURNING id, email, display_name`,
      [email, hash, req.body.displayName.trim()],
    );
    return res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'An account with that email already exists' });
    return next(e);
  }
});

router.post('/login', limiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const ok = rows[0] && await bcrypt.compare(String(req.body.password || ''), rows[0].password_hash);
    // Same message either way, so attackers can't tell which emails exist.
    if (!ok) return res.status(401).json({ error: 'Wrong email or password' });
    return res.json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
  } catch (e) { return next(e); }
});

// Profile: who am I + my reviews
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const u = await pool.query('SELECT id, email, display_name FROM users WHERE id = $1', [req.user.id]);
    if (!u.rows[0]) return res.status(404).json({ error: 'User not found' });
    const r = await pool.query(
      `SELECT r.id, r.course_code, r.rating, r.created_at, p.id AS professor_id, p.name AS professor_name
       FROM reviews r JOIN professors p ON p.id = r.professor_id
       WHERE r.user_id = $1 ORDER BY r.created_at DESC`, [req.user.id]);
    return res.json({ user: publicUser(u.rows[0]), reviews: r.rows });
  } catch (e) { return next(e); }
});

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body.displayName || '').trim();
    if (!name || name.length > 50) return res.status(400).json({ error: 'Display name must be 1-50 characters' });
    const { rows } = await pool.query(
      'UPDATE users SET display_name = $1 WHERE id = $2 RETURNING id, email, display_name', [name, req.user.id]);
    return res.json({ user: publicUser(rows[0]) });
  } catch (e) { return next(e); }
});

module.exports = router;
