#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

replace_var() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s#^${key}=.*#${key}=${value}#" .env
  else
    echo "${key}=${value}" >> .env
  fi
}

replace_var "NODE_ENV" "development"
replace_var "DB_HOST" "mysql"
replace_var "DB_PORT" "3306"
replace_var "DB_NAME" "picpix2"
replace_var "DB_USER" "picpix2_user"
replace_var "DB_PASSWORD" "strong_password"

echo "Codespace initialise: .env configure pour MySQL (service docker 'mysql')."
