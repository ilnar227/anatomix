const { Pool } = require('pg');
const config = require('./config');

function shouldUseSsl(connectionString) {
  if (process.env.DATABASE_SSL === 'false') return false;
  if (process.env.DATABASE_SSL === 'true') return true;
  return !/localhost|127\.0\.0\.1/.test(connectionString);
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  ...(shouldUseSsl(config.databaseUrl)
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});

module.exports = { pool };
