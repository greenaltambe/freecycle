'use strict';

process.env.SERVICE_NAME = 'location-service';

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const Joi     = require('joi');

const { db, errors, asyncH, logger } = require('@freecycle/shared');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'location-service' }));

const nearbySchema = Joi.object({
  latitude:     Joi.number().min(-90).max(90).required(),
  longitude:    Joi.number().min(-180).max(180).required(),
  radiusKm:     Joi.number().min(0.1).max(200).default(5),
  page:         Joi.number().integer().min(1).default(1),
  pageSize:     Joi.number().integer().min(1).max(50).default(20),
  status:       Joi.string().valid('available', 'taken').default('available'),
  categorySlug: Joi.string().max(50),
});

/**
 * GET /listings/nearby
 *   Returns listings within `radiusKm` of (lat,lng), ordered by distance.
 *   Uses GEOGRAPHY(POINT)::ST_DWithin with the GiST index on listings.location.
 */
app.get('/listings/nearby', asyncH(async (req, res) => {
  const { value, error } = nearbySchema.validate(req.query, { stripUnknown: true });
  if (error) {
    throw new errors.BadRequestError('Validation failed', error.details.map((d) => d.message));
  }
  const { latitude, longitude, radiusKm, page, pageSize, status, categorySlug } = value;
  const radiusMeters = radiusKm * 1000;

  const where  = ['l.status = $3', 'ST_DWithin(l.location, $1::geography, $2)'];
  const params = [
    `SRID=4326;POINT(${longitude} ${latitude})`,
    radiusMeters,
    status,
  ];

  if (categorySlug) {
    params.push(categorySlug);
    where.push(`c.slug = $${params.length}`);
  }
  params.push(pageSize, (page - 1) * pageSize);

  const sql = `
    SELECT l.id, l.user_id AS "userId", l.title, l.description, l.status,
           l.address_text AS "addressText",
           ST_Y(l.location::geometry) AS latitude,
           ST_X(l.location::geometry) AS longitude,
           ROUND((ST_Distance(l.location, $1::geography) / 1000.0)::numeric, 3) AS "distanceKm",
           c.slug AS "categorySlug", c.name AS "categoryName",
           l.created_at AS "createdAt"
      FROM listings l
      LEFT JOIN categories c ON c.id = l.category_id
     WHERE ${where.join(' AND ')}
     ORDER BY l.location <-> $1::geography
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const { rows: listings } = await db.query(sql, params);

  if (listings.length > 0) {
    const ids = listings.map((l) => l.id);
    const { rows: imgs } = await db.query(
      `SELECT id, listing_id AS "listingId", url, position
         FROM images
        WHERE listing_id = ANY($1::uuid[])
        ORDER BY listing_id, position`,
      [ids]
    );
    const grouped = imgs.reduce((acc, i) => {
      (acc[i.listingId] ||= []).push({ id: i.id, url: i.url, position: i.position });
      return acc;
    }, {});
    listings.forEach((l) => { l.images = grouped[l.id] || []; });
  }

  res.json({ page, pageSize, radiusKm, listings });
}));

/**
 * GET /users/nearby
 *   Returns user IDs within radiusKm of (lat,lng). Used by notification
 *   service to determine who should receive "new_nearby_listing" alerts.
 */
app.get('/users/nearby', asyncH(async (req, res) => {
  const schema = Joi.object({
    latitude:  Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    radiusKm:  Joi.number().min(0.1).max(200).default(10),
    excludeUserId: Joi.string().uuid(),
  });
  const { value, error } = schema.validate(req.query, { stripUnknown: true });
  if (error) {
    throw new errors.BadRequestError('Validation failed', error.details.map((d) => d.message));
  }
  const { latitude, longitude, radiusKm, excludeUserId } = value;

  const params = [
    `SRID=4326;POINT(${longitude} ${latitude})`,
    radiusKm * 1000,
  ];
  let extra = '';
  if (excludeUserId) {
    params.push(excludeUserId);
    extra = `AND id <> $${params.length}`;
  }

  const { rows } = await db.query(
    `SELECT id
       FROM users
      WHERE location IS NOT NULL
        AND ST_DWithin(location, $1::geography, $2)
        ${extra}`,
    params
  );
  res.json({ userIds: rows.map((r) => r.id) });
}));

app.use(errors.errorMiddleware);

const port = parseInt(process.env.LOCATION_SERVICE_PORT || '4003', 10);
app.listen(port, () => logger.info(`location-service listening on :${port}`));
