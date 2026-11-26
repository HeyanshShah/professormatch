require('dotenv').config();
const { createApp } = require('./app');

const PORT = process.env.PORT || 4000;
createApp().listen(PORT, () => console.log(`ProfMatch API running on http://localhost:${PORT}`));
