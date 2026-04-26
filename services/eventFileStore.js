'use strict';

const { pool } = require('../config/database');

let testFiles = [];
let nextTestFileId = 1;

function useTestStore() {
  return process.env.NODE_ENV === 'test';
}

function normalizeRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    eventId: row.eventId || row.event_id,
    uploadedByUserId: row.uploadedByUserId || row.uploaded_by_user_id || null,
    originalName: row.originalName || row.original_name,
    storedName: row.storedName || row.stored_name,
    sizeBytes: row.sizeBytes || row.size_bytes,
    storagePath: row.storagePath || row.storage_path,
    checksumSha256: row.checksumSha256 || row.checksum_sha256 || null,
    createdAt: row.createdAt || row.created_at,
  };
}

async function createFileRecord(payload) {
  const record = {
    eventId: Number(payload.eventId),
    uploadedByUserId: payload.uploadedByUserId ? Number(payload.uploadedByUserId) : null,
    originalName: payload.originalName,
    storedName: payload.storedName,
    sizeBytes: Number(payload.sizeBytes),
    storagePath: payload.storagePath,
    checksumSha256: payload.checksumSha256 || null,
  };

  if (useTestStore()) {
    const item = {
      id: nextTestFileId,
      ...record,
      createdAt: new Date().toISOString(),
    };

    testFiles.push(item);
    nextTestFileId += 1;
    return normalizeRow(item);
  }

  const [result] = await pool.query(`
    INSERT INTO event_files (
      event_id, uploaded_by_user_id, original_name, stored_name,
      size_bytes, storage_path, checksum_sha256
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    record.eventId,
    record.uploadedByUserId,
    record.originalName,
    record.storedName,
    record.sizeBytes,
    record.storagePath,
    record.checksumSha256,
  ]);

  const [rows] = await pool.query(`
    SELECT id, event_id AS eventId, uploaded_by_user_id AS uploadedByUserId,
           original_name AS originalName, stored_name AS storedName,
           size_bytes AS sizeBytes, storage_path AS storagePath,
           checksum_sha256 AS checksumSha256, created_at AS createdAt
    FROM event_files
    WHERE id = ?
    LIMIT 1
  `, [result.insertId]);

  return normalizeRow(rows[0]);
}

async function listByEvent(eventId) {
  if (useTestStore()) {
    return testFiles
      .filter((item) => item.eventId === Number(eventId))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .map(normalizeRow);
  }

  const [rows] = await pool.query(`
    SELECT id, event_id AS eventId, uploaded_by_user_id AS uploadedByUserId,
           original_name AS originalName, stored_name AS storedName,
           size_bytes AS sizeBytes, storage_path AS storagePath,
           checksum_sha256 AS checksumSha256, created_at AS createdAt
    FROM event_files
    WHERE event_id = ?
    ORDER BY created_at DESC, id DESC
  `, [eventId]);

  return rows.map(normalizeRow);
}

function resetTestState() {
  testFiles = [];
  nextTestFileId = 1;
}

module.exports = {
  createFileRecord,
  listByEvent,
  resetTestState,
};
