// Builds the Express app (kept separate from index.js so tests can import it).
const express = require('express');
const cors = require('cors');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '20kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/auth', require('./routes/auth'));
  app.use('/professors', require('./routes/professors'));

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });
  return app;
}

module.exports = { createApp };
