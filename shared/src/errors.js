'use strict';

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status  = status;
    this.details = details;
  }
}

class BadRequestError    extends HttpError { constructor(m, d) { super(400, m || 'Bad request', d); } }
class UnauthorizedError  extends HttpError { constructor(m, d) { super(401, m || 'Unauthorized', d); } }
class ForbiddenError     extends HttpError { constructor(m, d) { super(403, m || 'Forbidden', d); } }
class NotFoundError      extends HttpError { constructor(m, d) { super(404, m || 'Not found', d); } }
class ConflictError      extends HttpError { constructor(m, d) { super(409, m || 'Conflict', d); } }

/**
 * Express error-handling middleware. Use `app.use(errorMiddleware)`
 * as the LAST middleware in every service.
 */
function errorMiddleware(err, _req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }
  res.status(status).json({
    error: err.message || 'Internal server error',
    details: err.details,
  });
}

module.exports = {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  errorMiddleware,
};
