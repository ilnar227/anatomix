const express = require('express');
const cors = require('cors');
const config = require('./config');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const historyRoutes = require('./routes/history');
const favoritesRoutes = require('./routes/favorites');
const quotaRoutes = require('./routes/quota');

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', authRoutes);
  app.use('/api', profileRoutes);
  app.use('/api', historyRoutes);
  app.use('/api', favoritesRoutes);
  app.use('/api', quotaRoutes);

  return app;
}

module.exports = { createApp };
