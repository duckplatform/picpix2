#!/usr/bin/env bash
# ============================================================
# Reset complet de la base Codespace
# ============================================================
# Ce script :
#   1. Attend que MySQL soit disponible
#   2. Supprime toutes les tables de la base cible
#   3. Relance l'initialisation standard (schema + seed)
#
# Il ne depend pas de privileges CREATE/DROP DATABASE : il opere
# uniquement dans la base deja configuree pour le Codespace.
# ============================================================

set -euo pipefail

DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-lanparty}"
DB_PASSWORD="${DB_PASSWORD:-lanparty_dev}"
DB_NAME="${DB_NAME:-lanpartymanager}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

mysql_cmd() {
  MYSQL_PWD="${DB_PASSWORD}" mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" "$@"
}

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  LANPartyManager — Reset base Codespace            ${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""
echo "⏳ Verification de MySQL sur ${DB_HOST}:${DB_PORT}..."

MAX_ATTEMPTS=30
ATTEMPT=0
while true; do
  ATTEMPT=$((ATTEMPT + 1))

  if mysql_cmd -e "SELECT 1" &>/dev/null; then
    echo -e "${GREEN}✔ MySQL disponible.${NC}"
    break
  fi

  if [ "${ATTEMPT}" -ge "${MAX_ATTEMPTS}" ]; then
    echo -e "${RED}✗ MySQL non disponible apres ${MAX_ATTEMPTS} tentatives.${NC}"
    exit 1
  fi

  sleep 2
done

echo ""
echo "🧹 Suppression des tables de ${DB_NAME}..."

DROP_SQL=$(MYSQL_PWD="${DB_PASSWORD}" mysql -N -B -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" information_schema -e "
  SELECT IF(
    COUNT(*) = 0,
    'SELECT 1;',
    CONCAT(
      'SET FOREIGN_KEY_CHECKS=0; DROP TABLE ',
      GROUP_CONCAT(CONCAT(CHAR(96), table_name, CHAR(96)) ORDER BY table_name SEPARATOR ', '),
      '; SET FOREIGN_KEY_CHECKS=1;'
    )
  )
  FROM tables
  WHERE table_schema = '${DB_NAME}';")

if [ -z "${DROP_SQL}" ]; then
  echo -e "${RED}✗ Impossible de preparer le reset de la base.${NC}"
  exit 1
fi

mysql_cmd "${DB_NAME}" -e "${DROP_SQL}"

echo -e "${GREEN}✔ Tables supprimees.${NC}"

echo ""
echo "🔄 Reinitialisation complete de la base..."
bash /workspace/.devcontainer/init-db.sh