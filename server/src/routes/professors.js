const express = require('express');
const pool = require('../db/pool');
const { requireAuth, optionalAuth } = require('../auth');
const { validateReview } = require('../validate');
const { extractTags } = require('../text/tags');
const { sentiment } = require('../text/sentiment');
const { moderate } = require('../text/moderation');
const { STATS_CTE } = require('../ranking');
const { normalizeCourseCode, getOrCreateCourse } = require('../courses');

const router = express.Router();
const SORTS = {
  best: 'bayes_rating DESC, review_count DESC',
  most_reviewed: 'review_count DESC, bayes_rating DESC',
  easiest: 'avg_difficulty ASC NULLS LAST, bayes_rating DESC',
  name: 'name ASC',
};

// GET /professors?q=&department=&course=CS%20146&sort=best&page=1
router.get('/', async (req, res, next) => {
  try {
    const params = [];
    const where = [];
    const q = String(req.query.q || '').trim();
    if (q) { params.push(`%${q.toLowerCase()}%`); where.push(`lower(s.name) LIKE $${params.length}`); }
    if (req.query.department) { params.push(String(req.query.department)); where.push(`s.department = $${params.length}`); }
    if (req.query.course) {
      const code = normalizeCourseCode(req.query.course);
      if (!code) return res.status(400).json({ error: 'Course code should look like "CS 146"' });
      params.push(code);
      where.push(`EXISTS (SELECT 1 FROM professor_courses pc JOIN courses c ON c.id = pc.course_id
                          WHERE pc.professor_id = s.id AND c.code = $${params.length})`);
    }
    const sort = SORTS[req.query.sort] || SORTS.best;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    params.push(20, (page - 1) * 20);
    const { rows } = await pool.query(
      `${STATS_CTE} SELECT * FROM stats s ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY ${sort} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return res.json({ professors: rows, page });
  } catch (e) { return next(e); }
});

router.get('/departments', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT name FROM departments ORDER BY name');
    return res.json({ departments: rows.map((r) => r.name) });
  } catch (e) { return next(e); }
});

// GET /professors/:id  -> stats, courses, tags, sentiment summary, first page of reviews
// GET /professors/:id/reviews?cursor=...&sort=recent|helpful  -> more reviews (infinite scroll)
async function loadReviews(profId, viewerId, { cursor, sort = 'recent', limit = 10 }) {
  const params = [profId, viewerId || 0, limit + 1];
  let cursorSql = '';
  let order = 'r.created_at DESC, r.id DESC';
  if (sort === 'helpful') {
    order = 'r.helpful_count DESC, r.id DESC';
    if (cursor) {
      const [count, id] = String(cursor).split('_').map(Number);
      params.push(count, id);
      cursorSql = 'AND (r.helpful_count, r.id) < ($4, $5)';
    }
  } else if (cursor) {
    const [ts, id] = String(cursor).split('_');
    params.push(new Date(Number(ts)), Number(id));
    cursorSql = 'AND (r.created_at, r.id) < ($4, $5)';
  }
  // Keyset ("cursor") pagination: stable and fast even with millions of rows, unlike OFFSET.
  const { rows } = await pool.query(
    `SELECT r.id, c.code AS course_code, r.rating, r.difficulty, r.would_take_again, r.body, r.tags,
            r.sentiment, r.helpful_count, r.created_at, r.user_id, u.display_name AS author,
            EXISTS (SELECT 1 FROM review_votes v WHERE v.review_id = r.id AND v.user_id = $2) AS voted
     FROM reviews r JOIN users u ON u.id = r.user_id JOIN courses c ON c.id = r.course_id
     WHERE r.professor_id = $1 AND r.status = 'visible' ${cursorSql}
     ORDER BY ${order} LIMIT $3`, params);
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  let next = null;
  if (more && last) {
    next = sort === 'helpful' ? `${last.helpful_count}_${last.id}` : `${new Date(last.created_at).getTime()}_${last.id}`;
  }
  return { reviews: page, nextCursor: next };
}

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid professor id' });
    const prof = await pool.query(`${STATS_CTE} SELECT * FROM stats WHERE id = $1`, [id]);
    if (!prof.rows[0]) return res.status(404).json({ error: 'Professor not found' });
    const [tags, courses, mood, mine] = await Promise.all([
      pool.query(`SELECT tag, COUNT(*)::int AS count FROM reviews, unnest(tags) AS tag
                  WHERE professor_id = $1 AND status = 'visible' GROUP BY tag ORDER BY count DESC, tag LIMIT 6`, [id]),
      pool.query(`SELECT c.code FROM professor_courses pc JOIN courses c ON c.id = pc.course_id
                  WHERE pc.professor_id = $1 ORDER BY c.code`, [id]),
      pool.query(`SELECT COUNT(*) FILTER (WHERE sentiment > 0.2)::int AS positive,
                         COUNT(*) FILTER (WHERE sentiment < -0.2)::int AS negative,
                         COUNT(*)::int AS total
                  FROM reviews WHERE professor_id = $1 AND status = 'visible'`, [id]),
      req.user ? pool.query(`SELECT r.*, c.code AS course_code FROM reviews r JOIN courses c ON c.id = r.course_id
                             WHERE professor_id = $1 AND user_id = $2`, [id, req.user.id])
        : Promise.resolve({ rows: [] }),
    ]);
    const page = await loadReviews(id, req.user?.id, { sort: req.query.sort });
    return res.json({
      professor: prof.rows[0], topTags: tags.rows, courses: courses.rows.map((r) => r.code),
      sentiment: mood.rows[0], myReview: mine.rows[0] || null, ...page,
    });
  } catch (e) { return next(e); }
});

router.get('/:id/reviews', optionalAuth, async (req, res, next) => {
  try {
    const page = await loadReviews(parseInt(req.params.id, 10), req.user?.id,
      { cursor: req.query.cursor, sort: req.query.sort, limit: Math.min(50, parseInt(req.query.limit, 10) || 10) });
    return res.json(page);
  } catch (e) { return next(e); }
});

function checkReview(body) {
  const error = validateReview(body);
  if (error) return { status: 400, error };
  const code = normalizeCourseCode(body.courseCode);
  if (!code) return { status: 400, error: 'Course code should look like "CS 146"' };
  const mod = moderate(body.body);
  if (!mod.ok) return { status: 422, error: `Review not posted: ${mod.reasons.join(', ')}`, reasons: mod.reasons };
  return { code };
}

router.post('/:id/reviews', requireAuth, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const check = checkReview(req.body);
  if (check.error) return res.status(check.status).json({ error: check.error, reasons: check.reasons });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prof = await client.query('SELECT department_id FROM professors WHERE id = $1', [id]);
    if (!prof.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Professor not found' }); }
    const courseId = await getOrCreateCourse(client, check.code, prof.rows[0].department_id);
    await client.query('INSERT INTO professor_courses VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, courseId]);
    const b = req.body;
    const { rows } = await client.query(
      `INSERT INTO reviews (professor_id, user_id, course_id, rating, difficulty, would_take_again, body, tags, sentiment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, req.user.id, courseId, b.rating, b.difficulty, b.wouldTakeAgain, b.body.trim(),
        extractTags(b.body), sentiment(b.body)]);
    await client.query('COMMIT');
    return res.status(201).json({ review: { ...rows[0], course_code: check.code } });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'You already reviewed this professor. Edit your existing review instead.' });
    return next(e);
  } finally {
    client.release();
  }
});

router.put('/:id/reviews/mine', requireAuth, async (req, res, next) => {
  const check = checkReview(req.body);
  if (check.error) return res.status(check.status).json({ error: check.error, reasons: check.reasons });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = parseInt(req.params.id, 10);
    const prof = await client.query('SELECT department_id FROM professors WHERE id = $1', [id]);
    const courseId = await getOrCreateCourse(client, check.code, prof.rows[0]?.department_id);
    const b = req.body;
    const { rows } = await client.query(
      `UPDATE reviews SET course_id=$1, rating=$2, difficulty=$3, would_take_again=$4, body=$5, tags=$6, sentiment=$7
       WHERE professor_id=$8 AND user_id=$9 RETURNING *`,
      [courseId, b.rating, b.difficulty, b.wouldTakeAgain, b.body.trim(), extractTags(b.body),
        sentiment(b.body), id, req.user.id]);
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: "You haven't reviewed this professor yet" }); }
    await client.query('INSERT INTO professor_courses VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, courseId]);
    await client.query('COMMIT');
    return res.json({ review: { ...rows[0], course_code: check.code } });
  } catch (e) {
    await client.query('ROLLBACK');
    return next(e);
  } finally {
    client.release();
  }
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
