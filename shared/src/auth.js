'use strict';

const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('./errors');

const SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-me';
const EXPIRES = () => process.env.JWT_EXPIRES_IN || '7d';

function signToken(payload) {
  return jwt.sign(payload, SECRET(), { expiresIn: EXPIRES() });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET());
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/**
 * Express middleware. Reads `Authorization: Bearer <token>` and
 * attaches { id, email, username } to req.user. Trusts the gateway
 * but is also safe to use independently.
 */
function authRequired(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError('Missing bearer token'));
  }
  req.user = verifyToken(token);
  return next();
}

/**
 * Soft variant - populates req.user if a valid token is present,
 * but does NOT reject the request when missing.
 */
function authOptional(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try { req.user = verifyToken(token); } catch (_) { /* ignore */ }
  }
  return next();
}

module.exports = { signToken, verifyToken, authRequired, authOptional };
