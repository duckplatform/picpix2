#!/usr/bin/env bash
# ============================================================
# Démarrage de l'application
# Utilisé par postStartCommand dans devcontainer.json
# ============================================================
# Lance node app.js en arrière-plan et redirige les logs vers
# /tmp/app.log. Vérifie d'abord que MySQL est disponible,
# puis tue toute instance précédente avant de démarrer.
# ============================================================

set -euo pipefail

LOG_FILE="/tmp/app.log"
WORKSPACE="/workspace"
DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-lanparty}"
DB_PASSWORD="${DB_PASSWORD:-lanparty_dev}"

# ── Vérification que MySQL est accessible ──────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Démarrage de LANPartyManager..." > "${LOG_FILE}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Vérification de MySQL..." >> "${LOG_FILE}"

# Attendre max 30 secondes
ATTEMPTS=0
until MYSQL_PWD="${DB_PASSWORD}" mysql -h "${DB_HOST}" -P "${DB_PORT}" \
  -u "${DB_USER}" -e "SELECT 1" &>/dev/null; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "${ATTEMPTS}" -ge 30 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ MySQL non accessible — impossible de démarrer l'app" >> "${LOG_FILE}"
    echo "❌ MySQL non accessible —impossible de démarrer LANPartyManager"
    exit 1
  fi
  sleep 1
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✔ MySQL accessible" >> "${LOG_FILE}"

# Arrête l'instance existante si elle tourne déjà
pkill -f 'node app.js' 2>/dev/null || true
sleep 1

# Démarre l'application en arrière-plan depuis le dossier du workspace
cd "${WORKSPACE}"
node app.js >> "${LOG_FILE}" 2>&1 &
APP_PID=$!

echo "✅ LANPartyManager démarré (PID ${APP_PID})"
echo "   Logs : tail -f ${LOG_FILE}"