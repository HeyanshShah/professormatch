const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../auth');
const { validateReview } = require('../validate');
const { extractTags } = require('../feedback');

const router = express.Router();

// Shared SQL: professor info + review stats, computed by the database in one query.
const PROFESSOR_STATS = `
  SELECT p.id, p.name, d.name AS department,
         COUNT(r.id)::int                                   AS review_count,
         ROUND(AVG(r.rating), 1)::float                     AS avg_rating,
         ROUND(AVG(r.difficulty), 1)::float                 AS avg_difficulty,
         ROUND(100.0 * AVG(r.would_take_again::int))::int   AS take_again_pct
  FROM professors p
  JOIN departments d ON d.id = p.department_id
  LEFT JOIN reviews r ON r.professor_id = p.id`;

// GET /professors?q=patel&department=Computer%20Science&page=1
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const dept = String(req.query.department || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const params = [];
    const where = [];
    if (q) { params.push(`%${q.toLowerCase()}%`); where.push(`lower(p.name) LIKE $${params.length}`); }
    if (dept) { params.push(dept); where.push(`d.name = $${params.length}`); }
    params.push(limit, (page - 1) * limit);
    const sql = `${PROFESSOR_STATS}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY p.id, d.name
      ORDER BY review_count DESC, p.name
      LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await pool.query(sql, params);
    return res.json({ professors: rows, page });
  } catch (e) { return next(e); }
});

router.get('/departments', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT name FROM departments ORDER BY name');
    return res.json({ departments: rows.map((r) => r.name) });
  } catch (e) { return next(e); }
});

// GET /professors/:id  -> professor + stats + top tags + reviews
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid professor id' });
    const prof = await pool.query(`${PROFESSOR_STATS} WHERE p.id = $1 GROUP BY p.id, d.name`, [id]);
    if (!prof.rows[0]) return res.status(404).json({ error: 'Professor not found' });
    const reviews = await pool.query(
      `SELECT r.id, r.course_code, r.rating, r.difficulty, r.would_take_again, r.body, r.tags,
              r.created_at, u.display_name AS author, r.user_id
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.professor_id = $1 ORDER BY r.created_at DESC`, [id]);
    const tags = await pool.query(
      `SELECT tag, COUNT(*)::int AS count FROM reviews, unnest(tags) AS tag
       WHERE professor_id = $1 GROUP BY tag ORDER BY count DESC, tag LIMIT 5`, [id]);
    return res.json({ professor: prof.rows[0], topTags: tags.rows, reviews: reviews.rows });
  } catch (e) { return next(e); }
});

// POST /professors/:id/reviews  (must be logged in)
router.post('/:id/reviews', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const error = validateReview(req.body);
    if (error) return res.status(400).json({ error });
    const b = req.body;
    const tags = extractTags(b.body);
    const { rows } = await pool.query(
      `INSERT INTO reviews (professor_id, user_id, course_code, rating, difficulty, would_take_again, body, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, req.user.id, b.courseCode.trim().toUpperCase().replace(/^([A-Z]+)\s?/, '$1 '),
        b.rating, b.difficulty, b.wouldTakeAgain, b.body.trim(), tags]);
    return res.status(201).json({ review: rows[0] });
  } catch (e) {
    // 23505 = unique violation -> our one_review_per_user constraint
    if (e.code === '23505') return res.status(409).json({ error: 'You already reviewed this professor. Edit your existing review instead.' });
    if (e.code === '23503') return res.status(404).json({ error: 'Professor not found' });
    return next(e);
  }
});

// PUT /professors/:id/reviews/mine  -> edit my review
router.put('/:id/reviews/mine', requireAuth, async (req, res, next) => {
  try {
    const error = validateReview(req.body);
    if (error) return res.status(400).json({ error });
    const b = req.body;
    const { rows } = await pool.query(
      `UPDATE reviews SET course_code=$1, rating=$2, difficulty=$3, would_take_again=$4, body=$5, tags=$6
       WHERE professor_id=$7 AND user_id=$8 RETURNING *`,
      [b.courseCode.trim().toUpperCase(), b.rating, b.difficulty, b.wouldTakeAgain, b.body.trim(),
        extractTags(b.body), parseInt(req.params.id, 10), req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: "You haven't reviewed this professor yet" });
    return res.json({ review: rows[0] });
  } catch (e) { return next(e); }
});

router.delete('/:id/reviews/mine', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM reviews WHERE professor_id=$1 AND user_id=$2', [parseInt(req.params.id, 10), req.user.id]);
    if (!rowCount) return res.status(404).json({ error: 'No review to delete' });
    return res.status(204).end();
  } catch (e) { return next(e); }
});

module.exports = router;
