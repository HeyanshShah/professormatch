const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../auth');

const router = express.Router();
const AUTO_HIDE_AT = 3;   // reports from 3 different students hide a review pending moderation
const REASONS = ['offensive', 'personal_info', 'spam', 'false_info', 'other'];

// POST /reviews/:id/helpful  -> toggles your "helpful" vote
router.post('/:id/helpful', requireAuth, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const review = await client.query('SELECT user_id FROM reviews WHERE id = $1 FOR UPDATE', [id]);
    if (!review.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Review not found' }); }
    if (review.rows[0].user_id === req.user.id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "You can't vote on your own review" });
    }
    const del = await client.query('DELETE FROM review_votes WHERE review_id=$1 AND user_id=$2', [id, req.user.id]);
    const voted = del.rowCount === 0;
    if (voted) await client.query('INSERT INTO review_votes (review_id, user_id) VALUES ($1,$2)', [id, req.user.id]);
    const { rows } = await client.query(
      `UPDATE reviews SET helpful_count = (SELECT COUNT(*) FROM review_votes WHERE review_id = $1)
       WHERE id = $1 RETURNING helpful_count`, [id]);
    await client.query('COMMIT');
    return res.json({ voted, helpfulCount: rows[0].helpful_count });
  } catch (e) {
    await client.query('ROLLBACK');
    return next(e);
  } finally {
    client.release();
  }
});

// POST /reviews/:id/report {reason}
router.post('/:id/report', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const reason = req.body.reason;
    if (!REASONS.includes(reason)) return res.status(400).json({ error: `reason must be one of: ${REASONS.join(', ')}` });
    await pool.query('INSERT INTO review_reports (review_id, user_id, reason) VALUES ($1,$2,$3)', [id, req.user.id, reason]);
    const { rows } = await pool.query(
      `UPDATE reviews SET status = 'hidden'
       WHERE id = $1 AND status = 'visible'
         AND (SELECT COUNT(*) FROM review_reports WHERE review_id = $1) >= ${AUTO_HIDE_AT}
       RETURNING id`, [id]);
    return res.status(201).json({ reported: true, hidden: rows.length > 0 });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'You already reported this review' });
    if (e.code === '23503') return res.status(404).json({ error: 'Review not found' });
    return next(e);
  }
});

module.exports = router;
