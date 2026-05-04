'use strict';

process.env.SERVICE_NAME = 'chat-service';

const http    = require('http');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const { Server } = require('socket.io');

const { errors, logger } = require('@freecycle/shared');
const restRoutes  = require('./routes');
const attachSocket = require('./socket');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'chat-service' }));
app.use('/', restRoutes);
app.use(errors.errorMiddleware);

const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/socket.io',
});
attachSocket(io);

const port = parseInt(process.env.CHAT_SERVICE_PORT || '4004', 10);
server.listen(port, () => logger.info(`chat-service (HTTP+WS) listening on :${port}`));
