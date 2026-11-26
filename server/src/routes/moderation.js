const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireModerator } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireModerator(pool));

// Hidden (auto-hidden after reports) reviews waiting for a human decision.
router.get('/queue', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.body, r.status, p.name AS professor, COUNT(rr.*)::int AS reports,
              array_agg(DISTINCT rr.reason) AS reasons
       FROM reviews r JOIN professors p ON p.id = r.professor_id
       JOIN review_reports rr ON rr.review_id = r.id
       WHERE r.status = 'hidden' GROUP BY r.id, p.name ORDER BY reports DESC`);
    return res.json({ queue: rows });
  } catch (e) { return next(e); }
});

// POST /moderation/reviews/:id  {action: "restore" | "remove"}
router.post('/reviews/:id', async (req, res, next) => {
  try {
    const status = { restore: 'visible', remove: 'removed' }[req.body.action];
    if (!status) return res.status(400).json({ error: 'action must be restore or remove' });
    const { rows } = await pool.query('UPDATE reviews SET status=$1 WHERE id=$2 RETURNING id, status',
      [status, parseInt(req.params.id, 10)]);
    if (!rows[0]) return res.status(404).json({ error: 'Review not found' });
    if (status === 'visible') await pool.query('DELETE FROM review_reports WHERE review_id=$1', [rows[0].id]);
    return res.json(rows[0]);
  } catch (e) { return next(e); }
});

module.exports = router;
