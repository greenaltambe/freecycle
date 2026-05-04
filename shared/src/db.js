'use strict';

/**
 * Single shared pg.Pool per service process.
 * Reads connection settings from POSTGRES_* env vars.
 */
const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      host:     process.env.POSTGRES_HOST     || 'postgres',
      port:     parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB       || 'freecycle',
      user:     process.env.POSTGRES_USER     || 'freecycle',
      password: process.env.POSTGRES_PASSWORD || 'freecycle',
      max: 10,
      idleTimeoutMillis: 30000,
    });

    pool.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[db] unexpected pool error', err);
    });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

/**
 * Run a callback inside a single transaction.
 * Auto-commits on success, rolls back on throw.
 */
async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getPool, query, withTransaction };
