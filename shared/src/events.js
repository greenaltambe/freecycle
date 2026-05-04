'use strict';

/**
 * Lightweight Redis pub/sub event bus.
 *
 * Channels:
 *   listing.created      -> notification-service fans out "new_nearby_listing"
 *   listing.taken        -> notification-service notifies interested users
 *   chat.message_sent    -> notification-service creates "new_message"
 *
 * Each service can publish() and/or subscribe() independently.
 */

const { createClient } = require('redis');

let publisher;
let subscriber;

function url() {
  const host = process.env.REDIS_HOST || 'redis';
  const port = process.env.REDIS_PORT || '6379';
  return `redis://${host}:${port}`;
}

async function getPublisher() {
  if (!publisher) {
    publisher = createClient({ url: url() });
    publisher.on('error', (e) => console.error('[events:pub]', e));
    await publisher.connect();
  }
  return publisher;
}

async function getSubscriber() {
  if (!subscriber) {
    subscriber = createClient({ url: url() });
    subscriber.on('error', (e) => console.error('[events:sub]', e));
    await subscriber.connect();
  }
  return subscriber;
}

async function publish(channel, payload) {
  const pub = await getPublisher();
  await pub.publish(channel, JSON.stringify(payload));
}

async function subscribe(channel, handler) {
  const sub = await getSubscriber();
  await sub.subscribe(channel, (raw) => {
    try {
      handler(JSON.parse(raw));
    } catch (err) {
      console.error(`[events] handler error on ${channel}:`, err);
    }
  });
}

module.exports = { publish, subscribe };
