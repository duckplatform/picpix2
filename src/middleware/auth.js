const { User } = require("../models");

const attachCurrentUser = async (req, res, next) => {
  const userId = req.session?.userId;
  if (!userId) {
    res.locals.currentUser = null;
    return next();
  }

  const user = await User.findByPk(userId, {
    attributes: ["id", "username", "email", "fullName", "role", "isActive"],
  });

  if (!user || !user.isActive) {
    req.session.destroy(() => {});
    res.locals.currentUser = null;
    return next();
  }

  res.locals.currentUser = user;
  return next();
};

const requireAuth = (req, res, next) => {
  if (!req.session?.userId) {
    req.flash("error", "Veuillez vous connecter.");
    return res.redirect("/login");
  }
  return next();
};

const requireGuest = (req, res, next) => {
  if (req.session?.userId) {
    return res.redirect("/profile");
  }
  return next();
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    const role = req.session?.role;
    if (!role || !roles.includes(role)) {
      req.flash("error", "Accès non autorisé.");
      return res.redirect("/");
    }
    return next();
  };
};

module.exports = {
  attachCurrentUser,
  requireAuth,
  requireGuest,
  requireRole,
};
