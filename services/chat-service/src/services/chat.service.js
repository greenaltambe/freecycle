'use strict';

const { db, events, errors } = require('@freecycle/shared');

function orderPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

async function openOrGet(meId, otherUserId, listingId) {
  if (meId === otherUserId) {
    throw new errors.BadRequestError('Cannot open chat with yourself');
  }
  const [a, b] = orderPair(meId, otherUserId);

  const existing = await db.query(
    `SELECT id, listing_id AS "listingId", user_a_id AS "userAId",
            user_b_id AS "userBId", created_at AS "createdAt"
       FROM chats
      WHERE user_a_id = $1 AND user_b_id = $2
        AND ($3::uuid IS NULL OR listing_id IS NOT DISTINCT FROM $3::uuid)`,
    [a, b, listingId || null]
  );
  if (existing.rowCount > 0) return existing.rows[0];

  const { rows } = await db.query(
    `INSERT INTO chats (user_a_id, user_b_id, listing_id)
     VALUES ($1, $2, $3)
     RETURNING id, listing_id AS "listingId",
               user_a_id AS "userAId", user_b_id AS "userBId",
               created_at AS "createdAt"`,
    [a, b, listingId || null]
  );
  return rows[0];
}

async function assertParticipant(userId, chatId) {
  const { rows } = await db.query(
    `SELECT user_a_id, user_b_id FROM chats WHERE id = $1`, [chatId]
  );
  if (rows.length === 0) throw new errors.NotFoundError('Chat not found');
  const { user_a_id, user_b_id } = rows[0];
  if (user_a_id !== userId && user_b_id !== userId) {
    throw new errors.ForbiddenError('Not a participant of this chat');
  }
  return { otherId: user_a_id === userId ? user_b_id : user_a_id };
}

async function listForUser(userId) {
  const { rows } = await db.query(
    `SELECT c.id, c.listing_id AS "listingId",
            c.user_a_id AS "userAId", c.user_b_id AS "userBId",
            c.created_at AS "createdAt",
            (SELECT body FROM messages WHERE chat_id = c.id
              ORDER BY created_at DESC LIMIT 1) AS "lastMessage",
            (SELECT created_at FROM messages WHERE chat_id = c.id
              ORDER BY created_at DESC LIMIT 1) AS "lastMessageAt",
            (SELECT COUNT(*) FROM messages
              WHERE chat_id = c.id AND sender_id <> $1 AND read_at IS NULL) AS "unreadCount"
       FROM chats c
      WHERE c.user_a_id = $1 OR c.user_b_id = $1
      ORDER BY "lastMessageAt" DESC NULLS LAST, c.created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    ...r,
    otherUserId: r.userAId === userId ? r.userBId : r.userAId,
    unreadCount: parseInt(r.unreadCount, 10),
  }));
}

async function listMessages(userId, chatId, { limit, before }) {
  await assertParticipant(userId, chatId);
  const params = [chatId, limit];
  let extra = '';
  if (before) {
    params.push(before);
    extra = `AND created_at < $${params.length}`;
  }
  const { rows } = await db.query(
    `SELECT id, chat_id AS "chatId", sender_id AS "senderId",
            body, read_at AS "readAt", created_at AS "createdAt"
       FROM messages
      WHERE chat_id = $1 ${extra}
      ORDER BY created_at DESC
      LIMIT $2`,
    params
  );
  return rows.reverse(); // oldest first
}

async function sendMessage(senderId, chatId, body) {
  const { otherId } = await assertParticipant(senderId, chatId);
  const { rows } = await db.query(
    `INSERT INTO messages (chat_id, sender_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, chat_id AS "chatId", sender_id AS "senderId",
               body, read_at AS "readAt", created_at AS "createdAt"`,
    [chatId, senderId, body]
  );
  const message = rows[0];

  events.publish('chat.message_sent', {
    chatId,
    senderId,
    recipientId: otherId,
    body,
    messageId: message.id,
    createdAt: message.createdAt,
  }).catch((e) => console.error('publish chat.message_sent failed', e));

  return message;
}

async function markRead(userId, chatId) {
  await assertParticipant(userId, chatId);
  await db.query(
    `UPDATE messages
        SET read_at = NOW()
      WHERE chat_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
    [chatId, userId]
  );
}

module.exports = { openOrGet, listForUser, listMessages, sendMessage, markRead, assertParticipant };
