'use strict';

const Joi = require('joi');
const userService = require('../services/user.service');
const { errors } = require('@freecycle/shared');

const registerSchema = Joi.object({
  email:    Joi.string().email().required(),
  username: Joi.string().alphanum().min(3).max(50).required(),
  password: Joi.string().min(8).max(128).required(),
  fullName: Joi.string().max(120).allow('', null),
});

const loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().required(),
});

const updateMeSchema = Joi.object({
  fullName:  Joi.string().max(120).allow('', null),
  avatarUrl: Joi.string().uri().allow('', null),
});

const locationSchema = Joi.object({
  latitude:  Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
});

function validate(schema, payload) {
  const { value, error } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) throw new errors.BadRequestError('Validation failed', error.details.map((d) => d.message));
  return value;
}

exports.register = async (req, res) => {
  const data = validate(registerSchema, req.body);
  const { user, token } = await userService.register(data);
  res.status(201).json({ user, token });
};

exports.login = async (req, res) => {
  const data = validate(loginSchema, req.body);
  const { user, token } = await userService.login(data);
  res.json({ user, token });
};

exports.logout = async (_req, res) => {
  // JWT is stateless; client just discards the token.
  // This endpoint exists for parity and future blacklist support.
  res.json({ ok: true });
};

exports.me = async (req, res) => {
  const user = await userService.getById(req.user.id);
  res.json({ user });
};

exports.updateMe = async (req, res) => {
  const data = validate(updateMeSchema, req.body);
  const user = await userService.updateProfile(req.user.id, data);
  res.json({ user });
};

exports.updateLocation = async (req, res) => {
  const { latitude, longitude } = validate(locationSchema, req.body);
  const user = await userService.updateLocation(req.user.id, latitude, longitude);
  res.json({ user });
};

exports.getPublicProfile = async (req, res) => {
  const user = await userService.getPublic(req.params.id);
  res.json({ user });
};
