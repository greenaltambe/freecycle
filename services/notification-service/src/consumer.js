'use strict';

/**
 * Subscribes to Redis pub/sub channels and converts events into rows in
 * the `notifications` table.
 *
 * Channels handled:
 *   listing.created    -> "new_nearby_listing" for users near the listing
 *   listing.taken      -> "listing_taken" for the listing owner
 *   chat.message_sent  -> "new_message" for the recipient
 */

const { events, db, logger } = require('@freecycle/shared');

const NEARBY_RADIUS_KM = parseFloat(process.env.NEARBY_NOTIF_RADIUS_KM || '5');

async function notifyNewListing(payload) {
  const { id, userId, title, latitude, longitude } = payload;
  const { rows } = await db.query(
    `SELECT id FROM users
      WHERE id <> $1
        AND location IS NOT NULL
        AND ST_DWithin(
              location,
              ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
              $4)`,
    [userId, longitude, latitude, NEARBY_RADIUS_KM * 1000]
  );
  if (rows.length === 0) return;

  // Bulk insert
  const values = [];
  const params = [];
  rows.forEach((r, i) => {
    params.push(r.id, JSON.stringify({ listingId: id, title }));
    values.push(`($${i * 2 + 1}, 'new_nearby_listing', $${i * 2 + 2}::jsonb)`);
  });
  await db.query(
    `INSERT INTO notifications (user_id, type, payload) VALUES ${values.join(', ')}`,
    params
  );
  logger.info({ count: rows.length, listingId: id }, 'fanned out new_nearby_listing');
}

async function notifyMessage(payload) {
  const { recipientId, senderId, chatId, body } = payload;
  await db.query(
    `INSERT INTO notifications (user_id, type, payload)
     VALUES ($1, 'new_message', $2::jsonb)`,
    [recipientId, JSON.stringify({
      chatId, senderId, preview: body.slice(0, 140),
    })]
  );
}

async function notifyListingTaken(payload) {
  const { id, userId, title } = payload;
  await db.query(
    `INSERT INTO notifications (user_id, type, payload)
     VALUES ($1, 'listing_taken', $2::jsonb)`,
    [userId, JSON.stringify({ listingId: id, title })]
  );
}

async function start() {
  await events.subscribe('listing.created', (msg) =>
    notifyNewListing(msg).catch((e) => logger.error(e, 'listing.created handler')));
  await events.subscribe('listing.taken', (msg) =>
    notifyListingTaken(msg).catch((e) => logger.error(e, 'listing.taken handler')));
  await events.subscribe('chat.message_sent', (msg) =>
    notifyMessage(msg).catch((e) => logger.error(e, 'chat.message_sent handler')));

  logger.info('notification consumer subscribed to all channels');
}

module.exports = { start };
