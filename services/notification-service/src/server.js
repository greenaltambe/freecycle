'use strict';

process.env.SERVICE_NAME = 'notification-service';

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const { errors, logger } = require('@freecycle/shared');
const routes    = require('./routes');
const consumer  = require('./consumer');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'notification-service' }));
app.use('/', routes);
app.use(errors.errorMiddleware);

const port = parseInt(process.env.NOTIFICATION_SERVICE_PORT || '4005', 10);
app.listen(port, async () => {
  logger.info(`notification-service listening on :${port}`);
  await consumer.start();
});
