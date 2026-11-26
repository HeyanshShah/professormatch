const express = require('express');
const pool = require('../db/pool');
const { STATS_CTE, recommend, PREFERENCES } = require('../ranking');
const { normalizeCourseCode } = require('../courses');

const router = express.Router();

// GET /courses?q=cs1
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').toUpperCase().replace(/\s+/g, '');
    const { rows } = await pool.query(
      `SELECT c.code, c.title, COUNT(DISTINCT pc.professor_id)::int AS professors,
              COUNT(DISTINCT r.id)::int AS reviews
       FROM courses c LEFT JOIN professor_courses pc ON pc.course_id = c.id
       LEFT JOIN reviews r ON r.course_id = c.id AND r.status = 'visible'
       WHERE replace(c.code, ' ', '') LIKE $1
       GROUP BY c.id ORDER BY reviews DESC, c.code LIMIT 25`, [`%${q}%`]);
    return res.json({ courses: rows });
  } catch (e) { return next(e); }
});

// GET /courses/:code/recommendations?preference=easy|balanced|challenging
router.get('/:code/recommendations', async (req, res, next) => {
  try {
    const code = normalizeCourseCode(req.params.code);
    if (!code) return res.status(400).json({ error: 'Course code should look like "CS 146"' });
    const preference = req.query.preference || 'balanced';
    if (!PREFERENCES[preference]) return res.status(400).json({ error: `preference must be one of ${Object.keys(PREFERENCES).join(', ')}` });
    const { rows } = await pool.query(
      `${STATS_CTE} SELECT s.* FROM stats s
       JOIN professor_courses pc ON pc.professor_id = s.id
       JOIN courses c ON c.id = pc.course_id WHERE c.code = $1`, [code]);
    if (!rows.length) return res.status(404).json({ error: `No professors found for ${code}` });
    return res.json({ course: code, preference, recommendations: recommend(rows, preference) });
  } catch (e) { return next(e); }
});

module.exports = router;
