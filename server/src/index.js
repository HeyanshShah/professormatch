require('dotenv').config();
const { createApp } = require('./app');

const PORT = process.env.PORT || 4000;
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('JWT_SECRET must be set in production');
  process.exit(1);
}
createApp().listen(PORT, () => console.log(`ProfMatch API running on http://localhost:${PORT}`));
