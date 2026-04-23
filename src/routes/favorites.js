const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM favorites WHERE user_id = $1', [
      req.user.id,
    ]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/favorites', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO favorites (user_id, city) VALUES ($1, $2)
       ON CONFLICT (user_id, city) DO NOTHING`,
      [req.user.id, req.body.city]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/favorites/:city', authenticateToken, async (req, res) => {
  try {
    const city = decodeURIComponent(req.params.city);
    await pool.query('DELETE FROM favorites WHERE user_id = $1 AND city = $2', [
      req.user.id,
      city,
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
