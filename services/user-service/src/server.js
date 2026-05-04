'use strict';

process.env.SERVICE_NAME = 'user-service';

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const { errors, logger } = require('@freecycle/shared');
const routes = require('./routes');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'user-service' }));
app.use('/', routes);
app.use(errors.errorMiddleware);

const port = parseInt(process.env.USER_SERVICE_PORT || '4001', 10);
app.listen(port, () => logger.info(`user-service listening on :${port}`));
