'use strict';

process.env.SERVICE_NAME = 'listing-service';

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const { errors, logger } = require('@freecycle/shared');
const routes = require('./routes');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('tiny'));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'listing-service' }));
app.use('/', routes);
app.use(errors.errorMiddleware);

const port = parseInt(process.env.LISTING_SERVICE_PORT || '4002', 10);
app.listen(port, () => logger.info(`listing-service listening on :${port}`));
