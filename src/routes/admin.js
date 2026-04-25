const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { Router } = require("express");
const { User } = require("../models");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  adminCreateUserRules,
  adminUserRules,
  processValidation,
} = require("../middleware/validators");

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/admin/users", async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "username", "email", "fullName", "role", "isActive", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    return res.render("admin/users/index", {
      pageTitle: "Administration utilisateurs",
      users,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/users/new", (req, res) => {
  res.render("admin/users/new", { pageTitle: "Créer un utilisateur" });
});

router.post(
  "/admin/users",
  adminCreateUserRules,
  processValidation,
  async (req, res, next) => {
    try {
      const { username, email, fullName, role, password } = req.body;

      const existing = await User.findOne({
        where: { [Op.or]: [{ email: email.toLowerCase() }, { username }] },
      });
      if (existing) {
        req.flash("error", "Email ou nom d'utilisateur déjà utilisé.");
        return res.redirect("/admin/users/new");
      }

      await User.create({
        username,
        email,
        fullName,
        role,
        passwordHash: await bcrypt.hash(password, 12),
      });

      req.flash("success", "Utilisateur créé.");
      return res.redirect("/admin/users");
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/admin/users/:id/edit", async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ["id", "username", "email", "fullName", "role", "isActive"],
    });

    if (!user) {
      req.flash("error", "Utilisateur introuvable.");
      return res.redirect("/admin/users");
    }

    return res.render("admin/users/edit", {
      pageTitle: "Modifier utilisateur",
      user,
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/admin/users/:id",
  adminUserRules,
  processValidation,
  async (req, res, next) => {
    try {
      const target = await User.findByPk(req.params.id);
      if (!target) {
        req.flash("error", "Utilisateur introuvable.");
        return res.redirect("/admin/users");
      }

      const { username, email, fullName, role } = req.body;
      const isActive = req.body.isActive === "on";

      const conflict = await User.findOne({
        where: {
          id: { [Op.ne]: target.id },
          [Op.or]: [{ email: email.toLowerCase() }, { username }],
        },
      });

      if (conflict) {
        req.flash("error", "Email ou nom d'utilisateur déjà utilisé.");
        return res.redirect(`/admin/users/${target.id}/edit`);
      }

      target.username = username;
      target.email = email;
      target.fullName = fullName;
      target.role = role;
      target.isActive = isActive;

      if (target.id === req.session.userId && role !== "admin") {
        req.flash("error", "Vous ne pouvez pas retirer votre propre rôle admin.");
        return res.redirect(`/admin/users/${target.id}/edit`);
      }

      await target.save();
      req.flash("success", "Utilisateur mis à jour.");
      return res.redirect("/admin/users");
    } catch (error) {
      return next(error);
    }
  }
);

router.post("/admin/users/:id/delete", async (req, res, next) => {
  try {
    const target = await User.findByPk(req.params.id);
    if (!target) {
      req.flash("error", "Utilisateur introuvable.");
      return res.redirect("/admin/users");
    }

    if (target.id === req.session.userId) {
      req.flash("error", "Suppression de votre compte admin impossible ici.");
      return res.redirect("/admin/users");
    }

    await target.destroy();
    req.flash("success", "Utilisateur supprimé.");
    return res.redirect("/admin/users");
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
