const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { Router } = require("express");
const { User } = require("../models");
const { requireAuth } = require("../middleware/auth");
const { passwordRules, processValidation, profileRules } = require("../middleware/validators");

const router = Router();

router.get("/profile", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.session.userId, {
      attributes: ["id", "username", "email", "fullName", "role", "isActive", "createdAt"],
    });

    return res.render("profile/index", {
      pageTitle: "Mon profil",
      user,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/profile", requireAuth, profileRules, processValidation, async (req, res, next) => {
  try {
    const { username, email, fullName } = req.body;
    const user = await User.findByPk(req.session.userId);

    const conflict = await User.findOne({
      where: {
        id: { [Op.ne]: user.id },
        [Op.or]: [{ email: email.toLowerCase() }, { username }],
      },
    });

    if (conflict) {
      req.flash("error", "Email ou nom d'utilisateur déjà utilisé.");
      return res.redirect("/profile");
    }

    user.username = username;
    user.email = email;
    user.fullName = fullName;
    await user.save();

    req.flash("success", "Profil mis à jour.");
    return res.redirect("/profile");
  } catch (error) {
    return next(error);
  }
});

router.post("/profile/password", requireAuth, passwordRules, processValidation, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.session.userId);

    const valid = await user.verifyPassword(currentPassword);
    if (!valid) {
      req.flash("error", "Mot de passe actuel incorrect.");
      return res.redirect("/profile");
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    req.flash("success", "Mot de passe modifié.");
    return res.redirect("/profile");
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
