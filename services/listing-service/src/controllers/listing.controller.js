'use strict';

const Joi = require('joi');
const listingService = require('../services/listing.service');
const imageService   = require('../services/image.service');
const { errors } = require('@freecycle/shared');

const createSchema = Joi.object({
  title:        Joi.string().min(3).max(140).required(),
  description:  Joi.string().max(5000).allow('', null),
  categorySlug: Joi.string().max(50).allow('', null),
  latitude:     Joi.number().min(-90).max(90).required(),
  longitude:    Joi.number().min(-180).max(180).required(),
  addressText:  Joi.string().max(255).allow('', null),
});

const updateSchema = Joi.object({
  title:        Joi.string().min(3).max(140),
  description:  Joi.string().max(5000).allow('', null),
  categorySlug: Joi.string().max(50).allow('', null),
  latitude:     Joi.number().min(-90).max(90),
  longitude:    Joi.number().min(-180).max(180),
  addressText:  Joi.string().max(255).allow('', null),
}).min(1);

const statusSchema = Joi.object({
  status: Joi.string().valid('available', 'taken', 'removed').required(),
});

const listSchema = Joi.object({
  page:         Joi.number().integer().min(1).default(1),
  pageSize:     Joi.number().integer().min(1).max(50).default(20),
  status:       Joi.string().valid('available', 'taken', 'removed').default('available'),
  categorySlug: Joi.string().max(50),
  userId:       Joi.string().uuid(),
  q:            Joi.string().max(120),
});

function validate(schema, payload) {
  const { value, error } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new errors.BadRequestError('Validation failed', error.details.map((d) => d.message));
  return value;
}

exports.listCategories = async (_req, res) => {
  res.json({ categories: await listingService.listCategories() });
};

exports.list = async (req, res) => {
  const filters = validate(listSchema, req.query);
  res.json(await listingService.list(filters));
};

exports.getOne = async (req, res) => {
  res.json({ listing: await listingService.getById(req.params.id) });
};

exports.create = async (req, res) => {
  const data = validate(createSchema, req.body);
  const listing = await listingService.create(req.user.id, data);
  res.status(201).json({ listing });
};

exports.update = async (req, res) => {
  const data = validate(updateSchema, req.body);
  const listing = await listingService.update(req.user.id, req.params.id, data);
  res.json({ listing });
};

exports.updateStatus = async (req, res) => {
  const { status } = validate(statusSchema, req.body);
  const listing = await listingService.setStatus(req.user.id, req.params.id, status);
  res.json({ listing });
};

exports.remove = async (req, res) => {
  await listingService.remove(req.user.id, req.params.id);
  res.json({ ok: true });
};

exports.uploadImages = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new errors.BadRequestError('At least one image is required');
  }
  const images = await imageService.uploadMany(req.user.id, req.params.id, req.files);
  res.status(201).json({ images });
};

exports.deleteImage = async (req, res) => {
  await imageService.remove(req.user.id, req.params.listingId, req.params.imageId);
  res.json({ ok: true });
};
