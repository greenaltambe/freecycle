'use strict';

const bcrypt = require('bcryptjs');
const { db, auth, errors } = require('@freecycle/shared');

const PUBLIC_FIELDS = `
  id, email, username, full_name AS "fullName", avatar_url AS "avatarUrl",
  ST_Y(location::geometry) AS latitude,
  ST_X(location::geometry) AS longitude,
  created_at AS "createdAt"
`;

async function register({ email, username, password, fullName }) {
  const existing = await db.query(
    'SELECT 1 FROM users WHERE email = $1 OR username = $2',
    [email, username]
  );
  if (existing.rowCount > 0) {
    throw new errors.ConflictError('Email or username already in use');
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    `INSERT INTO users (email, username, password_hash, full_name)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_FIELDS}`,
    [email, username, hash, fullName || null]
  );

  const user = rows[0];
  const token = auth.signToken({ id: user.id, email: user.email, username: user.username });
  return { user, token };
}

async function login({ email, password }) {
  const { rows } = await db.query(
    `SELECT id, email, username, password_hash, full_name AS "fullName",
            avatar_url AS "avatarUrl"
       FROM users WHERE email = $1`,
    [email]
  );
  if (rows.length === 0) throw new errors.UnauthorizedError('Invalid credentials');

  const u  = rows[0];
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) throw new errors.UnauthorizedError('Invalid credentials');

  delete u.password_hash;
  const token = auth.signToken({ id: u.id, email: u.email, username: u.username });
  return { user: u, token };
}

async function getById(id) {
  const { rows } = await db.query(
    `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [id]
  );
  if (rows.length === 0) throw new errors.NotFoundError('User not found');
  return rows[0];
}

async function getPublic(id) {
  const { rows } = await db.query(
    `SELECT id, username, full_name AS "fullName", avatar_url AS "avatarUrl",
            created_at AS "createdAt"
       FROM users WHERE id = $1`,
    [id]
  );
  if (rows.length === 0) throw new errors.NotFoundError('User not found');
  return rows[0];
}

async function updateProfile(id, { fullName, avatarUrl }) {
  const { rows } = await db.query(
    `UPDATE users
        SET full_name  = COALESCE($2, full_name),
            avatar_url = COALESCE($3, avatar_url)
      WHERE id = $1
      RETURNING ${PUBLIC_FIELDS}`,
    [id, fullName, avatarUrl]
  );
  return rows[0];
}

async function updateLocation(id, lat, lng) {
  const { rows } = await db.query(
    `UPDATE users
        SET location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
      WHERE id = $1
      RETURNING ${PUBLIC_FIELDS}`,
    [id, lng, lat]
  );
  return rows[0];
}

module.exports = { register, login, getById, getPublic, updateProfile, updateLocation };
