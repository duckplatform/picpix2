const sequelize = require("../config/database");
const { User, initUserModel } = require("./User");

initUserModel(sequelize);

const syncModels = async () => {
  await sequelize.sync();
};

module.exports = {
  sequelize,
  User,
  syncModels,
};
