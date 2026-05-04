'use strict';

/**
 * Wrap async route handlers so thrown errors propagate to Express.
 *   router.get('/foo', asyncH(async (req, res) => { ... }))
 */
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
