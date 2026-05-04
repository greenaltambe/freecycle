'use strict';

const { Router } = require('express');
const { auth, asyncH, db } = require('@freecycle/shared');

const router = Router();

router.get('/notifications',
  auth.authRequired,
  asyncH(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
    const { rows } = await db.query(
      `SELECT id, type, payload, read_at AS "readAt", created_at AS "createdAt"
         FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [req.user.id, limit]
    );
    res.json({ notifications: rows });
  })
);

router.get('/notifications/unread-count',
  auth.authRequired,
  asyncH(async (req, res) => {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS count
         FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.id]
    );
    res.json({ count: rows[0].count });
  })
);

router.post('/notifications/:id/read',
  auth.authRequired,
  asyncH(async (req, res) => {
    await db.query(
      `UPDATE notifications SET read_at = NOW()
        WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  })
);

router.post('/notifications/read-all',
  auth.authRequired,
  asyncH(async (req, res) => {
    await db.query(
      `UPDATE notifications SET read_at = NOW()
        WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.id]
    );
    res.json({ ok: true });
  })
);

module.exports = router;
