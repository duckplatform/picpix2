const bcrypt = require("bcryptjs");
const { DataTypes, Model } = require("sequelize");

class User extends Model {
  async verifyPassword(password) {
    return bcrypt.compare(password, this.passwordHash);
  }
}

const initUserModel = (sequelize) => {
  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      email: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      fullName: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM("user", "admin"),
        allowNull: false,
        defaultValue: "user",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      tableName: "users",
      indexes: [{ fields: ["email"] }, { fields: ["username"] }, { fields: ["role"] }],
      hooks: {
        beforeValidate: (user) => {
          if (user.email) {
            user.email = user.email.toLowerCase();
          }
          if (user.username) {
            user.username = user.username.trim();
          }
        },
      },
    }
  );

  return User;
};

module.exports = { User, initUserModel };
