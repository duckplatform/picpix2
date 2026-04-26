'use strict';

/**
 * Configuration du logger Winston
 * Logs en console (dev) et fichiers rotatifs (prod)
 */

const winston = require('winston');
const path    = require('path');
const fs      = require('fs');

// Crée le dossier logs s'il n'existe pas
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Format lisible pour les fichiers
const fileFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, timestamp: ts, stack }) =>
    `[${ts}] ${level.toUpperCase()}: ${stack || message}`
  )
);

// Format colorisé pour la console
const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp: ts, stack }) =>
    `[${ts}] ${level}: ${stack || message}`
  )
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console (désactivée en test pour éviter le bruit)
    new winston.transports.Console({
      format: consoleFormat,
      silent: process.env.NODE_ENV === 'test',
    }),
    // Fichier principal
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      format:   fileFormat,
      maxsize:  5 * 1024 * 1024, // 5 MB
      maxFiles: 5,
      tailable: true,
    }),
    // Fichier d'erreurs uniquement
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level:    'error',
      format:   fileFormat,
      maxsize:  5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

module.exports = logger;