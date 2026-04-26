// Les variables d'environnement sont définies dans l'environnement d'exécution :
//   - En production (cPanel) : via le gestionnaire d'environnement cPanel
//   - En développement (Codespaces) : via le fichier .env chargé par le devcontainer
// Aucune dépendance dotenv n'est utilisée.

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  nodeEnv:       process.env.NODE_ENV       || "development",
  port:          toNumber(process.env.PORT, 3000),
  sessionSecret: process.env.SESSION_SECRET || "change-me-in-production",
  db: {
    host:     process.env.DB_HOST     || "127.0.0.1",
    port:     toNumber(process.env.DB_PORT, 3306),
    name:     process.env.DB_NAME     || "picpix2",
    user:     process.env.DB_USER     || "picpix2_user",
    password: process.env.DB_PASSWORD || "change-me",
  },
};
const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toNumber(process.env.PORT, 3000),
  sessionSecret: process.env.SESSION_SECRET || "insecure-dev-secret",
  db: {
    host: process.env.DB_HOST || "picpix2",
    port: toNumber(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME || "picpix2",
    user: process.env.DB_USER || "picpix2_user",
    password: process.env.DB_PASSWORD || "strong_password",
  },
  seedAdmin: {
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    username: process.env.SEED_ADMIN_USERNAME || "admin",
    fullName: process.env.SEED_ADMIN_FULLNAME || "Administrator",
  },
};
