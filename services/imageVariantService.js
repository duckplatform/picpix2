'use strict';

const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const logger = require('../config/logger');
const eventStore = require('./eventStore');

const VARIANT_SPECS = {
  xl: { width: 1600, quality: 84 },
  md: { width: 1024, quality: 82 },
  sm: { width: 640, quality: 78 },
};

const queue = [];
let isProcessing = false;

function sanitizeStoredName(storedName) {
  return /^[0-9a-f-]{36}\.[a-z0-9]{1,10}$/i.test(storedName || '');
}

function getVariantFileName(storedName, variantKey) {
  const ext = path.extname(storedName);
  const base = path.basename(storedName, ext);
  return `${base}-${variantKey}.jpg`;
}

function getOriginalPath(eventUuid, storedName) {
  return path.join(eventStore.getEventOriginalStoragePath(eventUuid), storedName);
}

function getVariantPath(eventUuid, storedName, variantKey) {
  return path.join(eventStore.getEventDerivedStoragePath(eventUuid), getVariantFileName(storedName, variantKey));
}

async function processOne(job) {
  const { eventUuid, storedName } = job;

  if (!sanitizeStoredName(storedName)) {
    logger.warn(`[IMG] Nom de fichier invalide ignore: ${storedName}`);
    return;
  }

  const inputPath = getOriginalPath(eventUuid, storedName);

  try {
    await fs.access(inputPath);
  } catch {
    logger.warn(`[IMG] Fichier original introuvable: ${inputPath}`);
    return;
  }

  try {
    await fs.mkdir(eventStore.getEventDerivedStoragePath(eventUuid), { recursive: true });

    const baseImage = sharp(inputPath, { failOn: 'none' }).rotate();

    await Promise.all(
      Object.entries(VARIANT_SPECS).map(async ([variantKey, spec]) => {
        const outputPath = getVariantPath(eventUuid, storedName, variantKey);

        await baseImage
          .clone()
          .resize({ width: spec.width, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: spec.quality, mozjpeg: true })
          .toFile(outputPath);
      }),
    );

    logger.info(`[IMG] Variantes generees pour ${eventUuid}/${storedName}`);
  } catch (err) {
    // Les uploads ne doivent jamais echouer a cause du post-processing.
    logger.warn(`[IMG] Echec generation variantes pour ${eventUuid}/${storedName}: ${err.message}`);
  }
}

async function drainQueue() {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    while (queue.length > 0) {
      const job = queue.shift();
      // eslint-disable-next-line no-await-in-loop
      await processOne(job);
    }
  } finally {
    isProcessing = false;
  }
}

function enqueueVariantGeneration(eventUuid, storedName) {
  queue.push({ eventUuid, storedName });
  setImmediate(() => {
    void drainQueue();
  });
}

async function variantExists(eventUuid, storedName, variantKey) {
  try {
    await fs.access(getVariantPath(eventUuid, storedName, variantKey));
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  VARIANT_SPECS,
  enqueueVariantGeneration,
  getOriginalPath,
  getVariantFileName,
  getVariantPath,
  sanitizeStoredName,
  variantExists,
};
