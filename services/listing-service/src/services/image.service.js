'use strict';

const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { db, errors } = require('@freecycle/shared');

const REGION  = process.env.AWS_REGION || 'us-east-1';
const BUCKET  = process.env.S3_BUCKET  || 'freecycle-listings-images';

const s3 = new S3Client({
  region: REGION,
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: !!process.env.S3_ENDPOINT, // for MinIO compatibility
});

function publicUrl(key) {
  if (process.env.S3_ENDPOINT) {
    return `${process.env.S3_ENDPOINT.replace(/\/$/, '')}/${BUCKET}/${key}`;
  }
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

async function assertOwner(userId, listingId) {
  const { rows } = await db.query(
    'SELECT user_id FROM listings WHERE id = $1', [listingId]
  );
  if (rows.length === 0)          throw new errors.NotFoundError('Listing not found');
  if (rows[0].user_id !== userId) throw new errors.ForbiddenError('Not your listing');
}

async function uploadMany(userId, listingId, files) {
  await assertOwner(userId, listingId);

  const inserted = [];
  for (const [i, file] of files.entries()) {
    const ext = (file.mimetype.split('/')[1] || 'bin').toLowerCase();
    const key = `listings/${listingId}/${crypto.randomUUID()}.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    const { rows } = await db.query(
      `INSERT INTO images (listing_id, url, s3_key, position)
       VALUES ($1, $2, $3, $4)
       RETURNING id, url, position`,
      [listingId, publicUrl(key), key, i]
    );
    inserted.push(rows[0]);
  }
  return inserted;
}

async function remove(userId, listingId, imageId) {
  await assertOwner(userId, listingId);
  const { rows } = await db.query(
    'SELECT s3_key FROM images WHERE id = $1 AND listing_id = $2',
    [imageId, listingId]
  );
  if (rows.length === 0) throw new errors.NotFoundError('Image not found');

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: rows[0].s3_key }));
  } catch (e) {
    // log only - continue with DB cleanup
    // eslint-disable-next-line no-console
    console.error('S3 delete failed', e);
  }
  await db.query('DELETE FROM images WHERE id = $1', [imageId]);
}

module.exports = { uploadMany, remove };
