'use strict';

const { Router } = require('express');
const Joi = require('joi');
const { auth, asyncH, errors } = require('@freecycle/shared');
const chatService = require('./services/chat.service');

const router = Router();

const openSchema = Joi.object({
  otherUserId: Joi.string().uuid().required(),
  listingId:   Joi.string().uuid(),
});

const sendSchema = Joi.object({
  body: Joi.string().min(1).max(2000).required(),
});

router.get('/chats',
  auth.authRequired,
  asyncH(async (req, res) => {
    res.json({ chats: await chatService.listForUser(req.user.id) });
  })
);

router.post('/chats',
  auth.authRequired,
  asyncH(async (req, res) => {
    const { value, error } = openSchema.validate(req.body, { stripUnknown: true });
    if (error) throw new errors.BadRequestError('Validation failed', error.details.map((d) => d.message));
    const chat = await chatService.openOrGet(req.user.id, value.otherUserId, value.listingId);
    res.status(201).json({ chat });
  })
);

router.get('/chats/:id/messages',
  auth.authRequired,
  asyncH(async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 100);
    const before = req.query.before; // ISO date for pagination
    const messages = await chatService.listMessages(req.user.id, req.params.id, { limit, before });
    res.json({ messages });
  })
);

router.post('/chats/:id/messages',
  auth.authRequired,
  asyncH(async (req, res) => {
    const { value, error } = sendSchema.validate(req.body, { stripUnknown: true });
    if (error) throw new errors.BadRequestError('Validation failed', error.details.map((d) => d.message));
    const message = await chatService.sendMessage(req.user.id, req.params.id, value.body);
    res.status(201).json({ message });
  })
);

router.post('/chats/:id/read',
  auth.authRequired,
  asyncH(async (req, res) => {
    await chatService.markRead(req.user.id, req.params.id);
    res.json({ ok: true });
  })
);

module.exports = router;
