const dotenv = require("dotenv");

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toNumber(process.env.PORT, 3000),
  sessionSecret: process.env.SESSION_SECRET || "insecure-dev-secret",
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: toNumber(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME || "picpix2",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  },
  seedAdmin: {
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    username: process.env.SEED_ADMIN_USERNAME || "admin",
    fullName: process.env.SEED_ADMIN_FULLNAME || "Administrator",
  },
};
