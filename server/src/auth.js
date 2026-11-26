// Authentication helpers.
// - Passwords are hashed with bcrypt (slow on purpose, so stolen hashes are hard to crack).
// - After login the server gives the app a JWT (JSON Web Token): a signed pass that
//   proves who you are. The app sends it back on every request in the
//   "Authorization: Bearer <token>" header. Tokens expire after 7 days.
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const EXPIRES_IN = '7d';

function signToken(user) {
  return jwt.sign({ sub: user.id, name: user.display_name }, SECRET, { expiresIn: EXPIRES_IN });
}

// Express middleware: blocks the request unless a valid token is attached.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = { id: payload.sub, name: payload.name };
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

// Like requireAuth, but anonymous visitors are allowed (req.user stays undefined).
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    try {
      const p = jwt.verify(header.slice(7), SECRET);
      req.user = { id: p.sub, name: p.name };
    } catch { /* ignore bad tokens for public routes */ }
  }
  next();
}

// Role check happens against the database, so demoting a moderator takes effect immediately.
function requireModerator(pool) {
  return async (req, res, next) => {
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (rows[0]?.role !== 'moderator') return res.status(403).json({ error: 'Moderators only' });
    return next();
  };
}

module.exports = { signToken, requireAuth, optionalAuth, requireModerator };
