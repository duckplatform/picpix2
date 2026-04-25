const { Sequelize } = require("sequelize");
const env = require("./env");

const isTest = env.nodeEnv === "test";

const sequelize = isTest
  ? new Sequelize("sqlite::memory:", { logging: false })
  : new Sequelize(env.db.name, env.db.user, env.db.password, {
      host: env.db.host,
      port: env.db.port,
      dialect: "mysql",
      logging: false,
      define: {
        underscored: true,
      },
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    });

module.exports = sequelize;
