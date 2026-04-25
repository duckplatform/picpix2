const bcrypt = require("bcryptjs");
const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const { Op } = require("sequelize");
const { User } = require("../models");
const { requireGuest } = require("../middleware/auth");
const { loginRules, processValidation, registerRules } = require("../middleware/validators");

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Trop de tentatives. Réessayez dans quelques minutes.",
});

router.get("/register", requireGuest, (req, res) => {
  res.render("auth/register", { pageTitle: "Inscription" });
});

router.post("/register", requireGuest, authLimiter, registerRules, processValidation, async (req, res, next) => {
  try {
    const { username, fullName, email, password } = req.body;

    const existing = await User.findOne({
      where: { [Op.or]: [{ email: email.toLowerCase() }, { username }] },
    });

    if (existing) {
      req.flash("error", "Un compte existe déjà avec cet email ou ce nom d'utilisateur.");
      return res.redirect("/register");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await User.create({
      username,
      fullName,
      email,
      passwordHash,
      role: "user",
    });

    req.flash("success", "Compte créé. Vous pouvez vous connecter.");
    return res.redirect("/login");
  } catch (error) {
    return next(error);
  }
});

router.get("/login", requireGuest, (req, res) => {
  res.render("auth/login", { pageTitle: "Connexion" });
});

router.post("/login", requireGuest, authLimiter, loginRules, processValidation, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email: email.toLowerCase() } });

    if (!user || !user.isActive) {
      req.flash("error", "Identifiants invalides.");
      return res.redirect("/login");
    }

    const validPassword = await user.verifyPassword(password);
    if (!validPassword) {
      req.flash("error", "Identifiants invalides.");
      return res.redirect("/login");
    }

    req.session.userId = user.id;
    req.session.role = user.role;

    req.flash("success", "Connexion réussie.");
    return req.session.save(() => res.redirect("/profile"));
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("picpix2.sid");
    res.redirect("/");
  });
});

module.exports = router;
