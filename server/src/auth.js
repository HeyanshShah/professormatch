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

module.exports = { signToken, requireAuth };
