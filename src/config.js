const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.resolve(process.cwd(), '.env') });

const isProd = process.env.NODE_ENV === 'production';

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD ?? '';
  const dbName = process.env.DB_NAME;
  const port = process.env.DB_PORT || '5432';
  if (!host || !user || !dbName) {
    return null;
  }
  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(password);
  return `postgresql://${encUser}:${encPass}@${host}:${port}/${dbName}`;
}

function parseCorsOrigin() {
  const raw = process.env.CORS_ORIGIN;
  if (raw === undefined || raw === '' || raw === '*') {
    return true;
  }
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return parts;
}

const databaseUrl = buildDatabaseUrl();
if (!databaseUrl) {
  throw new Error(
    'Database not configured: set DATABASE_URL, or DB_HOST, DB_USER, DB_NAME (and DB_PASSWORD / DB_PORT).'
  );
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET is required. Copy .env.example to .env and set a strong secret.');
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl,
  jwtSecret,
  corsOrigin: parseCorsOrigin(),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
};
