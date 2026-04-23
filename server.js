const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Подключение к MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Неверный токен' });
        req.user = user;
        next();
    });
};

// ==================== АВТОРИЗАЦИЯ ====================

// Регистрация
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        // Проверка существования пользователя
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Пользователь уже существует' });
        }
        
        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Создание пользователя
        const [result] = await pool.query(
            'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
            [email, hashedPassword, name]
        );
        
        // Создание JWT токена
        const token = jwt.sign(
            { id: result.insertId, email, name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({ token, user: { id: result.insertId, email, name } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Поиск пользователя
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ error: 'Неверный email или пароль' });
        }
        
        const user = users[0];
        
        // Проверка пароля
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Неверный email или пароль' });
        }
        
        // Создание JWT токена
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({ token, user: { id: user.id, email: user.email, name: user.name, theme: user.theme } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение профиля
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, email, name, theme FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление темы
app.put('/api/theme', authenticateToken, async (req, res) => {
    try {
        await pool.query('UPDATE users SET theme = ? WHERE id = ?', [req.body.theme, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ==================== ИСТОРИЯ ====================

// Получить историю
app.get('/api/history', authenticateToken, async (req, res) => {
    try {
        const [history] = await pool.query(
            'SELECT * FROM history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            [req.user.id]
        );
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Сохранить запрос в историю
app.post('/api/history', authenticateToken, async (req, res) => {
    try {
        const { city, event_type, temperature, wind, humidity, description, ai_verdict, ai_score } = req.body;
        
        await pool.query(
            'INSERT INTO history (user_id, city, event_type, temperature, wind, humidity, description, ai_verdict, ai_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, city, event_type, temperature, wind, humidity, description, ai_verdict, ai_score]
        );
        
        // Удаляем старые записи (оставляем последние 50)
        await pool.query(
            'DELETE FROM history WHERE user_id = ? AND id NOT IN (SELECT id FROM (SELECT id FROM history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50) as t)',
            [req.user.id, req.user.id]
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Очистить историю
app.delete('/api/history', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM history WHERE user_id = ?', [req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ==================== ИЗБРАННОЕ ====================

// Получить избранное
app.get('/api/favorites', authenticateToken, async (req, res) => {
    try {
        const [favorites] = await pool.query('SELECT * FROM favorites WHERE user_id = ?', [req.user.id]);
        res.json(favorites);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавить в избранное
app.post('/api/favorites', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'INSERT INTO favorites (user_id, city) VALUES (?, ?) ON DUPLICATE KEY UPDATE city = city',
            [req.user.id, req.body.city]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить из избранного
app.delete('/api/favorites/:city', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM favorites WHERE user_id = ? AND city = ?', [req.user.id, req.params.city]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Запуск сервера
// ==================== КВОТЫ ====================
async function checkQuota(userId) {
    const today = new Date().toISOString().split('T')[0];
    const [users] = await pool.query('SELECT quota, quota_reset FROM users WHERE id = ?', [userId]);
    
    if (users.length === 0) return 0;
    
    const user = users[0];
    const resetDate = new Date(user.quota_reset).toISOString().split('T')[0];
    
    // НЕ добавляем здесь +20, просто проверяем дату
    // +20 будет добавляться только при первом поиске за день (в use-quota)
    return user.quota;
}

app.post('/api/use-quota', authenticateToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const [users] = await pool.query('SELECT quota, quota_reset FROM users WHERE id = ?', [req.user.id]);
        
        if (users.length === 0) return res.json({ allowed: false });
        
        let quota = users[0].quota;
        const resetDate = new Date(users[0].quota_reset).toISOString().split('T')[0];
        
        // Только ОДИН раз в день добавляем +20
        if (resetDate !== today) {
            await pool.query('UPDATE users SET quota = quota + 20, quota_reset = ? WHERE id = ?', [today, req.user.id]);
            const [updated] = await pool.query('SELECT quota FROM users WHERE id = ?', [req.user.id]);
            quota = updated[0].quota;
        }
        
        if (quota <= 0) {
            return res.json({ allowed: false, message: 'Лимит исчерпан' });
        }
        
        await pool.query('UPDATE users SET quota = quota - 1 WHERE id = ?', [req.user.id]);
        const [after] = await pool.query('SELECT quota FROM users WHERE id = ?', [req.user.id]);
        
        res.json({ allowed: true, remaining: after[0].quota });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.post('/api/topup', authenticateToken, async (req, res) => {
    try {
        const { amount } = req.body;
        // Только пополняем баланс, НЕ добавляем запросы
        await pool.query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, req.user.id]);
        await pool.query('INSERT INTO payments (user_id, amount, quota_added) VALUES (?, ?, 0)', [req.user.id, amount]);
        const [users] = await pool.query('SELECT balance FROM users WHERE id = ?', [req.user.id]);
        res.json({ success: true, newBalance: parseFloat(users[0].balance) });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});
// Покупка запросов за баланс
app.post('/api/buy-quota', authenticateToken, async (req, res) => {
    try {
        const { quota } = req.body;
        const cost = parseInt(quota) / 2;
        const [users] = await pool.query('SELECT balance FROM users WHERE id = ?', [req.user.id]);
        const balance = parseFloat(users[0].balance);
        
        if (balance < cost) {
            return res.status(400).json({ error: 'Недостаточно средств' });
        }
        
        await pool.query(
            'UPDATE users SET balance = balance - ?, quota = quota + ? WHERE id = ?',
            [cost, quota, req.user.id]
        );
        
        const [updated] = await pool.query('SELECT balance, quota FROM users WHERE id = ?', [req.user.id]);
        res.json({
            success: true,
            newBalance: parseFloat(updated[0].balance),
            newQuota: updated[0].quota,
            added: quota
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});
app.get('/api/quota', authenticateToken, async (req, res) => {
    try {
        const quota = await checkQuota(req.user.id);
        const [users] = await pool.query('SELECT balance, is_premium FROM users WHERE id = ?', [req.user.id]);
        res.json({ quota, balance: parseFloat(users[0].balance), is_premium: users[0].is_premium });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка' });
    }
});
// ЗАПУСК СЕРВЕРА
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});