'use strict';

const { Router } = require('express');
const { auth, asyncH } = require('@freecycle/shared');
const ctrl = require('./controllers/user.controller');

const router = Router();

router.post('/auth/register', asyncH(ctrl.register));
router.post('/auth/login',    asyncH(ctrl.login));
router.post('/auth/logout',   asyncH(ctrl.logout));

router.get ('/users/me',       auth.authRequired, asyncH(ctrl.me));
router.put ('/users/me',       auth.authRequired, asyncH(ctrl.updateMe));
router.put ('/users/me/location', auth.authRequired, asyncH(ctrl.updateLocation));

router.get ('/users/:id',      asyncH(ctrl.getPublicProfile));

module.exports = router;
