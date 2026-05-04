'use strict';

const { db, events, errors } = require('@freecycle/shared');

const SELECT_LISTING = `
  l.id, l.user_id AS "userId", l.title, l.description, l.status,
  l.address_text AS "addressText",
  ST_Y(l.location::geometry) AS latitude,
  ST_X(l.location::geometry) AS longitude,
  c.slug AS "categorySlug", c.name AS "categoryName",
  l.created_at AS "createdAt", l.updated_at AS "updatedAt"
`;

async function attachImages(listings) {
  if (listings.length === 0) return listings;
  const ids = listings.map((l) => l.id);
  const { rows } = await db.query(
    `SELECT id, listing_id AS "listingId", url, position
       FROM images
      WHERE listing_id = ANY($1::uuid[])
      ORDER BY listing_id, position`,
    [ids]
  );
  const grouped = rows.reduce((acc, img) => {
    (acc[img.listingId] ||= []).push({ id: img.id, url: img.url, position: img.position });
    return acc;
  }, {});
  return listings.map((l) => ({ ...l, images: grouped[l.id] || [] }));
}

async function listCategories() {
  const { rows } = await db.query(
    'SELECT slug, name FROM categories ORDER BY name'
  );
  return rows;
}

async function getCategoryId(slug) {
  if (!slug) return null;
  const { rows } = await db.query(
    'SELECT id FROM categories WHERE slug = $1', [slug]
  );
  if (rows.length === 0) throw new errors.BadRequestError('Unknown category slug');
  return rows[0].id;
}

async function getById(id) {
  const { rows } = await db.query(
    `SELECT ${SELECT_LISTING}
       FROM listings l
       LEFT JOIN categories c ON c.id = l.category_id
      WHERE l.id = $1`,
    [id]
  );
  if (rows.length === 0) throw new errors.NotFoundError('Listing not found');
  const [listing] = await attachImages(rows);
  return listing;
}

async function list({ page, pageSize, status, categorySlug, userId, q }) {
  const where  = ['l.status = $1'];
  const params = [status];

  if (categorySlug) {
    params.push(categorySlug);
    where.push(`c.slug = $${params.length}`);
  }
  if (userId) {
    params.push(userId);
    where.push(`l.user_id = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(l.title ILIKE $${params.length} OR l.description ILIKE $${params.length})`);
  }

  params.push(pageSize, (page - 1) * pageSize);

  const { rows } = await db.query(
    `SELECT ${SELECT_LISTING}
       FROM listings l
       LEFT JOIN categories c ON c.id = l.category_id
      WHERE ${where.join(' AND ')}
      ORDER BY l.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const listings = await attachImages(rows);
  return { page, pageSize, listings };
}

async function create(userId, payload) {
  const categoryId = await getCategoryId(payload.categorySlug);
  const { rows } = await db.query(
    `INSERT INTO listings (user_id, category_id, title, description, location, address_text)
     VALUES ($1, $2, $3, $4,
             ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
             $7)
     RETURNING id`,
    [userId, categoryId, payload.title, payload.description || null,
     payload.longitude, payload.latitude, payload.addressText || null]
  );
  const listing = await getById(rows[0].id);

  events.publish('listing.created', {
    id: listing.id,
    userId: listing.userId,
    title: listing.title,
    latitude: listing.latitude,
    longitude: listing.longitude,
    createdAt: listing.createdAt,
  }).catch((e) => console.error('publish listing.created failed', e));

  return listing;
}

async function assertOwner(userId, listingId) {
  const { rows } = await db.query(
    'SELECT user_id FROM listings WHERE id = $1', [listingId]
  );
  if (rows.length === 0)            throw new errors.NotFoundError('Listing not found');
  if (rows[0].user_id !== userId)   throw new errors.ForbiddenError('Not your listing');
}

async function update(userId, id, payload) {
  await assertOwner(userId, id);
  const categoryId = payload.categorySlug !== undefined
    ? await getCategoryId(payload.categorySlug)
    : null;

  const fields = [];
  const params = [id];
  if (payload.title !== undefined)        { params.push(payload.title);        fields.push(`title = $${params.length}`); }
  if (payload.description !== undefined)  { params.push(payload.description);  fields.push(`description = $${params.length}`); }
  if (payload.addressText !== undefined)  { params.push(payload.addressText);  fields.push(`address_text = $${params.length}`); }
  if (payload.categorySlug !== undefined) { params.push(categoryId);           fields.push(`category_id = $${params.length}`); }
  if (payload.latitude !== undefined && payload.longitude !== undefined) {
    params.push(payload.longitude, payload.latitude);
    fields.push(`location = ST_SetSRID(ST_MakePoint($${params.length - 1}, $${params.length}), 4326)::geography`);
  }
  if (fields.length === 0) return getById(id);

  await db.query(`UPDATE listings SET ${fields.join(', ')} WHERE id = $1`, params);
  return getById(id);
}

async function setStatus(userId, id, status) {
  await assertOwner(userId, id);
  await db.query('UPDATE listings SET status = $2 WHERE id = $1', [id, status]);
  const listing = await getById(id);
  if (status === 'taken') {
    events.publish('listing.taken', { id: listing.id, userId: listing.userId, title: listing.title })
      .catch((e) => console.error('publish listing.taken failed', e));
  }
  return listing;
}

async function remove(userId, id) {
  await assertOwner(userId, id);
  await db.query(`UPDATE listings SET status = 'removed' WHERE id = $1`, [id]);
}

module.exports = {
  listCategories, getById, list, create, update, setStatus, remove,
};
