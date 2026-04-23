-- Создание базы данных
CREATE DATABASE IF NOT EXISTS weather_ai;
USE weather_ai;

-- Таблица пользователей
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    theme VARCHAR(10) DEFAULT 'dark',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица истории запросов
CREATE TABLE history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    city VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    temperature DECIMAL(5,2),
    wind DECIMAL(5,2),
    humidity INT,
    description VARCHAR(200),
    ai_verdict VARCHAR(50),
    ai_score INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Таблица избранных городов
CREATE TABLE favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    city VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_fav (user_id, city),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Индексы для быстрого поиска
CREATE INDEX idx_history_user ON history(user_id);
CREATE INDEX idx_favorites_user ON favorites(user_id);