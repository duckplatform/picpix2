const { body, validationResult } = require("express-validator");

const processValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const messages = errors.array().map((e) => e.msg);
  req.flash("error", messages.join(" "));
  const fallback = req.get("Referrer") || "/";
  return res.redirect(fallback);
};

const registerRules = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Le nom d'utilisateur doit contenir entre 3 et 50 caractères."),
  body("fullName").trim().isLength({ min: 2, max: 120 }).withMessage("Nom complet invalide."),
  body("email").trim().isEmail().withMessage("Adresse email invalide."),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Le mot de passe doit contenir au moins 8 caractères."),
];

const loginRules = [
  body("email").trim().isEmail().withMessage("Adresse email invalide."),
  body("password").isLength({ min: 1 }).withMessage("Mot de passe requis."),
];

const profileRules = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Le nom d'utilisateur doit contenir entre 3 et 50 caractères."),
  body("fullName").trim().isLength({ min: 2, max: 120 }).withMessage("Nom complet invalide."),
  body("email").trim().isEmail().withMessage("Adresse email invalide."),
];

const passwordRules = [
  body("currentPassword").isLength({ min: 1 }).withMessage("Mot de passe actuel requis."),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("Le nouveau mot de passe doit contenir au moins 8 caractères."),
];

const adminUserRules = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Le nom d'utilisateur doit contenir entre 3 et 50 caractères."),
  body("fullName").trim().isLength({ min: 2, max: 120 }).withMessage("Nom complet invalide."),
  body("email").trim().isEmail().withMessage("Adresse email invalide."),
  body("role").isIn(["user", "admin"]).withMessage("Rôle invalide."),
];

const adminCreateUserRules = [...adminUserRules, body("password").isLength({ min: 8 }).withMessage("Mot de passe trop court.")];

module.exports = {
  processValidation,
  registerRules,
  loginRules,
  profileRules,
  passwordRules,
  adminUserRules,
  adminCreateUserRules,
};
