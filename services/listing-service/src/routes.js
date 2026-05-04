'use strict';

const { Router } = require('express');
const multer = require('multer');
const { auth, asyncH } = require('@freecycle/shared');
const ctrl = require('./controllers/listing.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024, files: 6 }, // 5MB / 6 images
});

const router = Router();

router.get   ('/categories',           asyncH(ctrl.listCategories));

router.get   ('/listings',             auth.authOptional, asyncH(ctrl.list));
router.get   ('/listings/:id',         auth.authOptional, asyncH(ctrl.getOne));

router.post  ('/listings',             auth.authRequired, asyncH(ctrl.create));
router.put   ('/listings/:id',         auth.authRequired, asyncH(ctrl.update));
router.patch ('/listings/:id/status',  auth.authRequired, asyncH(ctrl.updateStatus));
router.delete('/listings/:id',         auth.authRequired, asyncH(ctrl.remove));

router.post  ('/listings/:id/images',
              auth.authRequired,
              upload.array('images', 6),
              asyncH(ctrl.uploadImages));

router.delete('/listings/:listingId/images/:imageId',
              auth.authRequired,
              asyncH(ctrl.deleteImage));

module.exports = router;
