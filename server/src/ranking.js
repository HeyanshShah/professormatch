// Fair rankings and recommendations.
//
// Bayesian average (the IMDb Top-250 formula):
//     score = (C * m + sum_of_ratings) / (C + n)
// m = average rating across ALL professors, C = how many "imaginary average reviews"
// every professor starts with. One 5-star review gives (3*3.6 + 5)/4 = 3.95, not 5.0,
// so a professor with 40 reviews averaging 4.7 correctly ranks above them.
const PRIOR_WEIGHT = 3;

// SQL fragment: per-professor stats + Bayesian score, only counting visible reviews.
const STATS_CTE = `
  WITH global AS (
    SELECT COALESCE(AVG(rating), 3.5)::float AS m FROM reviews WHERE status = 'visible'
  ), stats AS (
    SELECT p.id, p.name, d.name AS department,
           COUNT(r.id)::int AS review_count,
           ROUND(AVG(r.rating), 2)::float AS avg_rating,
           ROUND(AVG(r.difficulty), 1)::float AS avg_difficulty,
           ROUND(100.0 * AVG(r.would_take_again::int))::int AS take_again_pct,
           ROUND(AVG(r.sentiment)::numeric, 2)::float AS avg_sentiment,
           ROUND(((${PRIOR_WEIGHT} * (SELECT m FROM global) + COALESCE(SUM(r.rating), 0))
                 / (${PRIOR_WEIGHT} + COUNT(r.id)))::numeric, 2)::float AS bayes_rating
    FROM professors p
    JOIN departments d ON d.id = p.department_id
    LEFT JOIN reviews r ON r.professor_id = p.id AND r.status = 'visible'
    GROUP BY p.id, d.name
  )`;

// Recommendation score for a course, given what the student wants.
// Each component is 0..1; weights depend on preference.
const PREFERENCES = {
  easy:        { quality: 0.35, retake: 0.25, ease: 0.40 },
  balanced:    { quality: 0.50, retake: 0.30, ease: 0.20 },
  challenging: { quality: 0.55, retake: 0.15, rigor: 0.30 },
};

function recommend(rows, preference = 'balanced') {
  const w = PREFERENCES[preference];
  if (!w) throw new Error(`preference must be one of ${Object.keys(PREFERENCES).join(', ')}`);
  return rows.map((r) => {
    const parts = {
      quality: (r.bayes_rating - 1) / 4,
      retake: (r.take_again_pct ?? 50) / 100,
      ease: r.avg_difficulty == null ? 0.5 : (5 - r.avg_difficulty) / 4,
      rigor: r.avg_difficulty == null ? 0.5 : (r.avg_difficulty - 1) / 4,
    };
    const confidence = Math.min(1, r.review_count / 10); // few reviews -> less certain
    const score = Object.entries(w).reduce((s, [k, wt]) => s + wt * parts[k], 0);
    return {
      ...r,
      match: Math.round(score * 100),
      confidence: Math.round(confidence * 100),
      why: Object.fromEntries(Object.keys(w).map((k) => [k, Math.round(parts[k] * 100)])),
    };
  }).sort((a, b) => b.match - a.match || b.review_count - a.review_count);
}

module.exports = { STATS_CTE, PRIOR_WEIGHT, recommend, PREFERENCES };
