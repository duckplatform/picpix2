'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const { pool } = require('../config/database');
const userStore = require('./userStore');

const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const EVENT_STORAGE_ROOT = path.join(__dirname, '..', 'storage', 'events');

let testEvents = [];
let nextTestEventId = 1;

function useTestStore() {
  return process.env.NODE_ENV === 'test';
}

function randomToken(length = 10) {
  let token = '';
  for (let index = 0; index < length; index += 1) {
    const alphabetIndex = crypto.randomInt(0, TOKEN_ALPHABET.length);
    token += TOKEN_ALPHABET[alphabetIndex];
  }
  return token;
}

function eventStoragePath(eventUuid) {
  return path.join(EVENT_STORAGE_ROOT, eventUuid);
}

async function ensureEventStorageDirectory(eventUuid) {
  await fs.mkdir(eventStoragePath(eventUuid), { recursive: true });
}

async function removeEventStorageDirectory(eventUuid) {
  await fs.rm(eventStoragePath(eventUuid), { recursive: true, force: true });
}

function normalizeRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    uuid: row.uuid,
    ownerUserId: row.ownerUserId || row.owner_user_id,
    ownerEmail: row.ownerEmail || row.owner_email || null,
    ownerFullName: row.ownerFullName || row.owner_full_name || null,
    name: row.name,
    description: row.description || '',
    startsAt: row.startsAt || row.starts_at,
    status: row.status,
    token: row.token,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  };
}

async function ensureUniqueToken(token) {
  if (useTestStore()) {
    return !testEvents.some((eventItem) => eventItem.token === token);
  }

  const [rows] = await pool.query('SELECT id FROM events WHERE token = ? LIMIT 1', [token]);
  return rows.length === 0;
}

async function generateUniqueToken() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const token = randomToken(10);
    // On boucle jusqu'a obtenir un token libre; collisions tres peu probables.
    // Cette verification explicite garantit l'unicite en test et en MySQL.
    // eslint-disable-next-line no-await-in-loop
    if (await ensureUniqueToken(token)) {
      return token;
    }
  }

  const err = new Error('TOKEN_GENERATION_FAILED');
  err.code = 'TOKEN_GENERATION_FAILED';
  throw err;
}

async function listByOwner(ownerUserId) {
  if (useTestStore()) {
    return testEvents
      .filter((eventItem) => eventItem.ownerUserId === Number(ownerUserId))
      .sort((left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime())
      .map((eventItem) => normalizeRow({ ...eventItem }));
  }

  const [rows] = await pool.query(`
    SELECT id, uuid, owner_user_id AS ownerUserId, name, description,
           starts_at AS startsAt, status, token,
           created_at AS createdAt, updated_at AS updatedAt
    FROM events
    WHERE owner_user_id = ?
    ORDER BY starts_at DESC, id DESC
  `, [ownerUserId]);

  return rows.map(normalizeRow);
}

async function listAll() {
  if (useTestStore()) {
    const enriched = [];
    for (const eventItem of testEvents) {
      // eslint-disable-next-line no-await-in-loop
      const owner = await userStore.findPublicById(eventItem.ownerUserId);
      enriched.push(normalizeRow({
        ...eventItem,
        ownerEmail: owner ? owner.email : null,
        ownerFullName: owner ? owner.fullName : null,
      }));
    }

    return enriched.sort((left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime());
  }

  const [rows] = await pool.query(`
    SELECT e.id, e.uuid, e.owner_user_id AS ownerUserId,
           u.email AS ownerEmail, u.full_name AS ownerFullName,
           e.name, e.description, e.starts_at AS startsAt, e.status, e.token,
           e.created_at AS createdAt, e.updated_at AS updatedAt
    FROM events e
    INNER JOIN users u ON u.id = e.owner_user_id
    ORDER BY e.starts_at DESC, e.id DESC
  `);

  return rows.map(normalizeRow);
}

async function findById(eventId) {
  if (useTestStore()) {
    const found = testEvents.find((eventItem) => eventItem.id === Number(eventId));
    if (!found) {
      return null;
    }

    const owner = await userStore.findPublicById(found.ownerUserId);
    return normalizeRow({
      ...found,
      ownerEmail: owner ? owner.email : null,
      ownerFullName: owner ? owner.fullName : null,
    });
  }

  const [rows] = await pool.query(`
    SELECT e.id, e.uuid, e.owner_user_id AS ownerUserId,
           u.email AS ownerEmail, u.full_name AS ownerFullName,
           e.name, e.description, e.starts_at AS startsAt, e.status, e.token,
           e.created_at AS createdAt, e.updated_at AS updatedAt
    FROM events e
    INNER JOIN users u ON u.id = e.owner_user_id
    WHERE e.id = ?
    LIMIT 1
  `, [eventId]);

  return normalizeRow(rows[0]);
}

async function findByToken(token) {
  if (useTestStore()) {
    const found = testEvents.find((eventItem) => eventItem.token === token);
    if (!found) {
      return null;
    }

    const owner = await userStore.findPublicById(found.ownerUserId);
    return normalizeRow({
      ...found,
      ownerEmail: owner ? owner.email : null,
      ownerFullName: owner ? owner.fullName : null,
    });
  }

  const [rows] = await pool.query(`
    SELECT e.id, e.uuid, e.owner_user_id AS ownerUserId,
           u.email AS ownerEmail, u.full_name AS ownerFullName,
           e.name, e.description, e.starts_at AS startsAt, e.status, e.token,
           e.created_at AS createdAt, e.updated_at AS updatedAt
    FROM events e
    INNER JOIN users u ON u.id = e.owner_user_id
    WHERE e.token = ?
    LIMIT 1
  `, [token]);

  return normalizeRow(rows[0]);
}

async function createEvent({ ownerUserId, name, description = '', startsAt, status = 'inactive', token }) {
  const eventToken = token || await generateUniqueToken();
  const eventUuid = crypto.randomUUID();

  await ensureEventStorageDirectory(eventUuid);

  if (useTestStore()) {
    const tokenExists = testEvents.some((eventItem) => eventItem.token === eventToken);
    if (tokenExists) {
      await removeEventStorageDirectory(eventUuid);
      const duplicateError = new Error('EVENT_UNIQUE_CONSTRAINT');
      duplicateError.code = 'EVENT_UNIQUE_CONSTRAINT';
      throw duplicateError;
    }

    const eventItem = {
      id: nextTestEventId,
      uuid: eventUuid,
      ownerUserId: Number(ownerUserId),
      name,
      description,
      startsAt,
      status,
      token: eventToken,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    testEvents.push(eventItem);
    nextTestEventId += 1;
    return findById(eventItem.id);
  }

  try {
    const [result] = await pool.query(`
      INSERT INTO events (uuid, owner_user_id, name, description, starts_at, status, token)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [eventUuid, ownerUserId, name, description, startsAt, status, eventToken]);

    return findById(result.insertId);
  } catch (err) {
    await removeEventStorageDirectory(eventUuid);

    if (err && err.code === 'ER_DUP_ENTRY') {
      const duplicateError = new Error('EVENT_UNIQUE_CONSTRAINT');
      duplicateError.code = 'EVENT_UNIQUE_CONSTRAINT';
      throw duplicateError;
    }

    throw err;
  }
}

async function updateEvent(eventId, payload) {
  const current = await findById(eventId);
  if (!current) {
    return null;
  }

  const nextData = {
    ownerUserId: payload.ownerUserId || current.ownerUserId,
    name: payload.name || current.name,
    description: payload.description !== undefined ? payload.description : current.description,
    startsAt: payload.startsAt || current.startsAt,
    status: payload.status || current.status,
    token: payload.token || current.token,
  };

  if (useTestStore()) {
    const tokenExists = testEvents.some((eventItem) => eventItem.token === nextData.token && eventItem.id !== current.id);
    if (tokenExists) {
      const duplicateError = new Error('EVENT_UNIQUE_CONSTRAINT');
      duplicateError.code = 'EVENT_UNIQUE_CONSTRAINT';
      throw duplicateError;
    }

    testEvents = testEvents.map((eventItem) => {
      if (eventItem.id !== current.id) {
        return eventItem;
      }

      return {
        ...eventItem,
        ownerUserId: Number(nextData.ownerUserId),
        ...nextData,
        updatedAt: new Date().toISOString(),
      };
    });

    return findById(current.id);
  }

  try {
    await pool.query(`
      UPDATE events
      SET owner_user_id = ?, name = ?, description = ?, starts_at = ?, status = ?, token = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [nextData.ownerUserId, nextData.name, nextData.description, nextData.startsAt, nextData.status, nextData.token, current.id]);

    return findById(current.id);
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      const duplicateError = new Error('EVENT_UNIQUE_CONSTRAINT');
      duplicateError.code = 'EVENT_UNIQUE_CONSTRAINT';
      throw duplicateError;
    }

    throw err;
  }
}

async function deleteEvent(eventId) {
  if (useTestStore()) {
    const targetIndex = testEvents.findIndex((eventItem) => eventItem.id === Number(eventId));
    if (targetIndex === -1) {
      return false;
    }

    const [removedEvent] = testEvents.splice(targetIndex, 1);
    await removeEventStorageDirectory(removedEvent.uuid);
    return true;
  }

  const existing = await findById(eventId);
  if (!existing) {
    return false;
  }

  const [result] = await pool.query('DELETE FROM events WHERE id = ?', [eventId]);
  if (result.affectedRows === 0) {
    return false;
  }

  await removeEventStorageDirectory(existing.uuid);
  return true;
}

function resetTestState() {
  testEvents = [];
  nextTestEventId = 1;
}

module.exports = {
  createEvent,
  deleteEvent,
  findById,
  findByToken,
  generateUniqueToken,
  listAll,
  listByOwner,
  resetTestState,
  updateEvent,
};