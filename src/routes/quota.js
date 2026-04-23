const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

async function checkQuota(userId) {
  const { rows } = await pool.query('SELECT quota FROM users WHERE id = $1', [userId]);
  if (rows.length === 0) return 0;
  return rows[0].quota;
}

router.post('/use-quota', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { rows: users } = await pool.query(
      'SELECT quota, quota_reset FROM users WHERE id = $1',
      [req.user.id]
    );

    if (users.length === 0) return res.json({ allowed: false });

    let quota = users[0].quota;
    const resetDate = users[0].quota_reset
      ? new Date(users[0].quota_reset).toISOString().split('T')[0]
      : null;

    if (resetDate !== today) {
      await pool.query('UPDATE users SET quota = quota + 20, quota_reset = $1::date WHERE id = $2', [
        today,
        req.user.id,
      ]);
      const { rows: updated } = await pool.query('SELECT quota FROM users WHERE id = $1', [
        req.user.id,
      ]);
      quota = updated[0].quota;
    }

    if (quota <= 0) {
      return res.json({ allowed: false, message: 'Лимит исчерпан' });
    }

    await pool.query('UPDATE users SET quota = quota - 1 WHERE id = $1', [req.user.id]);
    const { rows: after } = await pool.query('SELECT quota FROM users WHERE id = $1', [
      req.user.id,
    ]);

    res.json({ allowed: true, remaining: after[0].quota });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

router.post('/topup', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [
      amount,
      req.user.id,
    ]);
    await pool.query(
      'INSERT INTO payments (user_id, amount, quota_added) VALUES ($1, $2, 0)',
      [req.user.id, amount]
    );
    const { rows: users } = await pool.query('SELECT balance FROM users WHERE id = $1', [
      req.user.id,
    ]);
    res.json({ success: true, newBalance: parseFloat(users[0].balance) });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

router.post('/buy-quota', authenticateToken, async (req, res) => {
  try {
    const { quota } = req.body;
    const cost = parseInt(quota, 10) / 2;
    const { rows: users } = await pool.query('SELECT balance FROM users WHERE id = $1', [
      req.user.id,
    ]);
    const balance = parseFloat(users[0].balance);

    if (balance < cost) {
      return res.status(400).json({ error: 'Недостаточно средств' });
    }

    await pool.query(
      'UPDATE users SET balance = balance - $1, quota = quota + $2 WHERE id = $3',
      [cost, quota, req.user.id]
    );

    const { rows: updated } = await pool.query(
      'SELECT balance, quota FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({
      success: true,
      newBalance: parseFloat(updated[0].balance),
      newQuota: updated[0].quota,
      added: quota,
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

router.get('/quota', authenticateToken, async (req, res) => {
  try {
    const quota = await checkQuota(req.user.id);
    const { rows: users } = await pool.query(
      'SELECT balance, is_premium FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({
      quota,
      balance: parseFloat(users[0].balance),
      is_premium: users[0].is_premium,
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

module.exports = router;
