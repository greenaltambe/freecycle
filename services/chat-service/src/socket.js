'use strict';

/**
 * Socket.IO gateway for real-time messaging.
 *
 * Auth: client must connect with `auth: { token: '<JWT>' }`.
 * Each authenticated socket joins a personal room `user:<id>` so the
 * server can push messages, typing indicators, and read receipts.
 *
 * Client events:
 *   join_chat   { chatId }
 *   leave_chat  { chatId }
 *   send_message { chatId, body }
 *   typing      { chatId, isTyping }
 *   mark_read   { chatId }
 *
 * Server events:
 *   message_received  { ...message }
 *   typing            { chatId, userId, isTyping }
 *   read_receipt      { chatId, userId }
 */

const { auth, logger } = require('@freecycle/shared');
const chatService = require('./services/chat.service');

module.exports = function attachSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
              || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('Missing auth token'));
    try {
      socket.user = auth.verifyToken(token);
      return next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.user.id;
    socket.join(`user:${uid}`);
    logger.info({ uid }, 'socket connected');

    socket.on('join_chat', async ({ chatId }, ack) => {
      try {
        await chatService.assertParticipant(uid, chatId);
        socket.join(`chat:${chatId}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('leave_chat', ({ chatId }) => {
      socket.leave(`chat:${chatId}`);
    });

    socket.on('send_message', async ({ chatId, body }, ack) => {
      try {
        const message = await chatService.sendMessage(uid, chatId, body);
        io.to(`chat:${chatId}`).emit('message_received', message);
        // Also push to personal rooms so users see it without joining the chat room
        const { otherId } = await chatService.assertParticipant(uid, chatId);
        io.to(`user:${otherId}`).emit('message_received', message);
        ack?.({ ok: true, message });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('typing', ({ chatId, isTyping }) => {
      socket.to(`chat:${chatId}`).emit('typing', { chatId, userId: uid, isTyping: !!isTyping });
    });

    socket.on('mark_read', async ({ chatId }, ack) => {
      try {
        await chatService.markRead(uid, chatId);
        io.to(`chat:${chatId}`).emit('read_receipt', { chatId, userId: uid });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('disconnect', () => logger.info({ uid }, 'socket disconnected'));
  });
};
