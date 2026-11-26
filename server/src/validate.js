// Small input validators. Never trust what the client sends.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignup({ email, password, displayName }) {
  if (!email || !EMAIL_RE.test(email)) return 'Enter a valid email';
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!displayName || !displayName.trim()) return 'Display name is required';
  if (displayName.length > 50) return 'Display name is too long';
  return null;
}

function validateReview(b) {
  const int = (v) => Number.isInteger(v) && v >= 1 && v <= 5;
  if (!int(b.rating)) return 'Rating must be a whole number from 1 to 5';
  if (!int(b.difficulty)) return 'Difficulty must be a whole number from 1 to 5';
  if (typeof b.wouldTakeAgain !== 'boolean') return 'Would-take-again must be yes or no';
  const len = (b.body || '').trim().length;
  if (len < 10 || len > 1000) return 'Review must be 10-1000 characters';
  return null;
}

module.exports = { validateSignup, validateReview };
