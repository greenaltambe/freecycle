'use strict';

/**
 * API Gateway
 * - Single entry point on port GATEWAY_PORT (default 8080)
 * - Verifies JWT for protected routes (and forwards Authorization)
 * - Reverse-proxies HTTP requests to internal services
 * - Reverse-proxies WebSocket upgrades to chat-service (/socket.io)
 *
 * Public routes (no JWT required at gateway):
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/listings, /api/listings/:id, /api/listings/nearby
 *   GET  /api/categories
 *   GET  /api/users/:id (public profile)
 *   /socket.io/*  (chat-service authenticates the WS handshake itself)
 */

process.env.SERVICE_NAME = 'api-gateway';

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

const { auth, errors, logger } = require('@freecycle/shared');

const PORT = parseInt(process.env.GATEWAY_PORT || '8080', 10);

const targets = {
  user:        process.env.USER_SERVICE_URL         || 'http://user-service:4001',
  listing:     process.env.LISTING_SERVICE_URL      || 'http://listing-service:4002',
  location:    process.env.LOCATION_SERVICE_URL     || 'http://location-service:4003',
  chat:        process.env.CHAT_SERVICE_URL         || 'http://chat-service:4004',
  notification:process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4005',
};

const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

// --- Health (no auth) ---
app.get('/health', (_req, res) => res.json({ ok: true, service: 'api-gateway', targets }));

// --- WebSocket proxy MUST be registered before the auth gate.
//     chat-service authenticates Socket.IO handshakes itself.
const wsProxy = createProxyMiddleware({
  target: targets.chat,
  changeOrigin: true,
  ws: true,
  logLevel: 'warn',
});
app.use('/socket.io', wsProxy);

// --- Rate limiting on auth endpoints (brute-force defense) ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(['/api/auth/login', '/api/auth/register'], authLimiter);

// --- Selective auth: required vs optional ---
// We match against req.originalUrl so this works regardless of how the
// middleware is mounted on the router.
const PUBLIC_GET_PREFIXES = [
  '/api/categories',
  '/api/listings/nearby',
  '/api/listings',           // GET only (covers list + /:id)
  '/api/users/',             // GET /api/users/:id only
];

function requireAuthIfNeeded(req, res, next) {
  const url = req.originalUrl.split('?')[0];
  if (!url.startsWith('/api/')) return next();
  if (url.startsWith('/api/auth/')) return next();

  const isPublicGet = req.method === 'GET'
    && PUBLIC_GET_PREFIXES.some((p) => url.startsWith(p));
  if (isPublicGet) return auth.authOptional(req, res, next);
  return auth.authRequired(req, res, next);
}
app.use(requireAuthIfNeeded);

// --- HTTP proxy helpers ---
function proxy(target, pathRewrite) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    proxyTimeout: 20000,
    onError(err, _req, res) {
      logger.error({ err: err.message, target }, 'gateway proxy error');
      if (res && !res.headersSent) {
        res.status(502).json({ error: 'Upstream service unavailable' });
      }
    },
  });
}

const stripApi = { '^/api': '' };

app.use('/api/auth',            proxy(targets.user,         stripApi));
app.use('/api/users',           proxy(targets.user,         stripApi));
app.use('/api/categories',      proxy(targets.listing,      stripApi));
app.use('/api/listings/nearby', proxy(targets.location,     stripApi));
app.use('/api/listings',        proxy(targets.listing,      stripApi));
app.use('/api/chats',           proxy(targets.chat,         stripApi));
app.use('/api/notifications',   proxy(targets.notification, stripApi));

// --- Final 404 + error handlers ---
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errors.errorMiddleware);

// --- Boot HTTP server (also handles WS upgrades for /socket.io) ---
const server = app.listen(PORT, () => logger.info(`api-gateway on :${PORT}`));
server.on('upgrade', wsProxy.upgrade);
