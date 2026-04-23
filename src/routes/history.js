const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/history', authenticateToken, async (req, res) => {
  try {
    const {
      city,
      event_type,
      temperature,
      wind,
      humidity,
      description,
      ai_verdict,
      ai_score,
    } = req.body;

    await pool.query(
      `INSERT INTO history (user_id, city, event_type, temperature, wind, humidity, description, ai_verdict, ai_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        req.user.id,
        city,
        event_type,
        temperature,
        wind,
        humidity,
        description,
        ai_verdict,
        ai_score,
      ]
    );

    await pool.query(
      `DELETE FROM history
       WHERE user_id = $1
         AND id NOT IN (
           SELECT id FROM (
             SELECT id FROM history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50
           ) AS retained
         )`,
      [req.user.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/history', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM history WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
