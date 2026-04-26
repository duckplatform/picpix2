'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');

const logger = require('../config/logger');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const userStore = require('../services/userStore');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop de tentatives, veuillez reessayer plus tard.',
});

function renderView(res, view, payload = {}, status = 200) {
  return res.status(status).render(view, {
    title: 'PicPix2',
    pageClass: '',
    formData: {},
    fieldErrors: {},
    ...payload,
  });
}

function collectFieldErrors(result) {
  return result.array().reduce((accumulator, error) => {
    if (!accumulator[error.path]) {
      accumulator[error.path] = error.msg;
    }
    return accumulator;
  }, {});
}

function ensureGuest(req, res, next) {
  if (req.currentUser) {
    return res.redirect('/profile');
  }

  return next();
}

function passwordRules(fieldName = 'password', required = true) {
  const chain = body(fieldName)
    .trim()
    .isLength({ min: 8, max: 72 }).withMessage('Le mot de passe doit contenir entre 8 et 72 caracteres.')
    .matches(/[a-z]/).withMessage('Le mot de passe doit contenir au moins une minuscule.')
    .matches(/[A-Z]/).withMessage('Le mot de passe doit contenir au moins une majuscule.')
    .matches(/[0-9]/).withMessage('Le mot de passe doit contenir au moins un chiffre.');

  return required ? chain : chain.optional({ values: 'falsy' });
}

const registrationValidators = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 120 }).withMessage('Le nom complet doit contenir entre 2 et 120 caracteres.'),
  body('email')
    .trim()
    .isEmail().withMessage('Adresse email invalide.')
    .normalizeEmail(),
  passwordRules('password'),
  body('confirmPassword')
    .trim()
    .custom((value, { req }) => value === req.body.password).withMessage('La confirmation du mot de passe est invalide.'),
];

const loginValidators = [
  body('email').trim().isEmail().withMessage('Adresse email invalide.').normalizeEmail(),
  body('password').trim().notEmpty().withMessage('Mot de passe requis.'),
];

const adminUserValidators = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 120 }).withMessage('Le nom complet doit contenir entre 2 et 120 caracteres.'),
  body('email')
    .trim()
    .isEmail().withMessage('Adresse email invalide.')
    .normalizeEmail(),
  body('role')
    .trim()
    .isIn(['user', 'admin']).withMessage('Role invalide.'),
  body('status')
    .trim()
    .isIn(['active', 'disabled']).withMessage('Statut invalide.'),
  passwordRules('password', false),
];

const profileValidators = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 120 }).withMessage('Le nom complet doit contenir entre 2 et 120 caracteres.'),
  body('currentPassword')
    .trim()
    .custom((value, { req }) => {
      if (req.body.password && !value) {
        throw new Error('Le mot de passe actuel est requis pour modifier votre mot de passe.');
      }
      return true;
    }),
  passwordRules('password', false),
  body('confirmPassword')
    .trim()
    .custom((value, { req }) => {
      if (!req.body.password) {
        return true;
      }
      return value === req.body.password;
    }).withMessage('La confirmation du mot de passe est invalide.'),
];

router.get('/', (req, res) => {
  res.render('home', {
    title: 'Accueil',
    pageClass: 'page-home',
  });
});

router.get('/register', ensureGuest, (req, res) => renderView(res, 'auth/register', {
  title: 'Inscription',
  pageClass: 'page-auth',
}));

router.post('/register', authLimiter, ensureGuest, registrationValidators, async (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return renderView(res, 'auth/register', {
      title: 'Inscription',
      pageClass: 'page-auth',
      formData: req.body,
      fieldErrors: collectFieldErrors(result),
    }, 422);
  }

  try {
    const user = await userStore.createUser({
      email: req.body.email,
      password: req.body.password,
      fullName: req.body.fullName,
    });

    req.session.userId = user.id;
    logger.info(`[AUTH] Nouvelle inscription: ${user.email}`);
    req.flash('success', 'Votre compte a ete cree.');
    return res.redirect('/profile');
  } catch (err) {
    if (err.code === 'EMAIL_ALREADY_EXISTS') {
      return renderView(res, 'auth/register', {
        title: 'Inscription',
        pageClass: 'page-auth',
        formData: req.body,
        fieldErrors: { email: 'Cette adresse email est deja utilisee.' },
      }, 409);
    }

    return next(err);
  }
});

router.get('/login', ensureGuest, (req, res) => renderView(res, 'auth/login', {
  title: 'Connexion',
  pageClass: 'page-auth',
}));

router.post('/login', authLimiter, ensureGuest, loginValidators, async (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return renderView(res, 'auth/login', {
      title: 'Connexion',
      pageClass: 'page-auth',
      formData: req.body,
      fieldErrors: collectFieldErrors(result),
    }, 422);
  }

  try {
    const user = await userStore.findByEmail(req.body.email);
    if (!user || user.status !== 'active') {
      req.flash('error', 'Identifiants invalides.');
      return res.redirect('/login');
    }

    const passwordMatches = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!passwordMatches) {
      req.flash('error', 'Identifiants invalides.');
      return res.redirect('/login');
    }

    req.session.userId = user.id;
    await userStore.updateLastLogin(user.id);
    logger.info(`[AUTH] Connexion reussie: ${user.email}`);
    req.flash('success', 'Connexion reussie.');
    return res.redirect('/profile');
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', requireAuth, (req, res, next) => {
  const email = req.currentUser.email;
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }

    logger.info(`[AUTH] Deconnexion: ${email}`);
    res.clearCookie('sid');
    return res.redirect('/login');
  });
});

router.get('/profile', requireAuth, (req, res) => renderView(res, 'profile', {
  title: 'Mon profil',
  pageClass: 'page-profile',
  formData: {
    fullName: req.currentUser.fullName,
  },
}));

router.put('/profile', requireAuth, profileValidators, async (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return renderView(res, 'profile', {
      title: 'Mon profil',
      pageClass: 'page-profile',
      formData: req.body,
      fieldErrors: collectFieldErrors(result),
    }, 422);
  }

  try {
    const storedUser = await userStore.findById(req.currentUser.id);

    if (req.body.password) {
      const passwordMatches = await bcrypt.compare(req.body.currentPassword, storedUser.passwordHash);
      if (!passwordMatches) {
        return renderView(res, 'profile', {
          title: 'Mon profil',
          pageClass: 'page-profile',
          formData: req.body,
          fieldErrors: { currentPassword: 'Le mot de passe actuel est incorrect.' },
        }, 422);
      }
    }

    await userStore.updateUser(req.currentUser.id, {
      fullName: req.body.fullName,
      password: req.body.password || undefined,
    });

    logger.info(`[PROFILE] Mise a jour du profil: ${req.currentUser.email}`);
    req.flash('success', 'Votre profil a ete mis a jour.');
    return res.redirect('/profile');
  } catch (err) {
    return next(err);
  }
});

router.get('/admin', requireAdmin, async (req, res, next) => {
  try {
    const users = await userStore.listUsers();
    return renderView(res, 'admin/dashboard', {
      title: 'Administration',
      pageClass: 'page-admin',
      users,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/admin/users/new', requireAdmin, (req, res) => renderView(res, 'admin/user-form', {
  title: 'Nouvel utilisateur',
  pageClass: 'page-admin',
  mode: 'create',
  formData: { role: 'user', status: 'active' },
  editingUser: null,
}));

router.post('/admin/users', requireAdmin, adminUserValidators, async (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty() || !req.body.password) {
    const fieldErrors = collectFieldErrors(result);
    if (!req.body.password) {
      fieldErrors.password = 'Le mot de passe est requis.';
    }

    return renderView(res, 'admin/user-form', {
      title: 'Nouvel utilisateur',
      pageClass: 'page-admin',
      mode: 'create',
      editingUser: null,
      formData: req.body,
      fieldErrors,
    }, 422);
  }

  try {
    await userStore.createUser({
      email: req.body.email,
      password: req.body.password,
      fullName: req.body.fullName,
      role: req.body.role,
      status: req.body.status,
    });

    logger.info(`[ADMIN] ${req.currentUser.email} a cree l'utilisateur ${req.body.email}`);
    req.flash('success', 'Utilisateur cree avec succes.');
    return res.redirect('/admin');
  } catch (err) {
    if (err.code === 'EMAIL_ALREADY_EXISTS') {
      return renderView(res, 'admin/user-form', {
        title: 'Nouvel utilisateur',
        pageClass: 'page-admin',
        mode: 'create',
        editingUser: null,
        formData: req.body,
        fieldErrors: { email: 'Cette adresse email est deja utilisee.' },
      }, 409);
    }

    return next(err);
  }
});

router.get('/admin/users/:id/edit', requireAdmin, param('id').isInt({ min: 1 }), async (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(404).render('errors/404', {
      title: 'Utilisateur introuvable',
      pageClass: 'page-error',
    });
  }

  try {
    const editingUser = await userStore.findPublicById(Number(req.params.id));
    if (!editingUser) {
      return res.status(404).render('errors/404', {
        title: 'Utilisateur introuvable',
        pageClass: 'page-error',
      });
    }

    return renderView(res, 'admin/user-form', {
      title: 'Modifier un utilisateur',
      pageClass: 'page-admin',
      mode: 'edit',
      editingUser,
      formData: editingUser,
    });
  } catch (err) {
    return next(err);
  }
});

router.put('/admin/users/:id', requireAdmin, param('id').isInt({ min: 1 }), adminUserValidators, async (req, res, next) => {
  const result = validationResult(req);
  const userId = Number(req.params.id);
  if (!result.isEmpty()) {
    const editingUser = await userStore.findPublicById(userId);
    return renderView(res, 'admin/user-form', {
      title: 'Modifier un utilisateur',
      pageClass: 'page-admin',
      mode: 'edit',
      editingUser,
      formData: { ...req.body, id: userId },
      fieldErrors: collectFieldErrors(result),
    }, 422);
  }

  try {
    const targetUser = await userStore.findById(userId);
    if (!targetUser) {
      return res.status(404).render('errors/404', {
        title: 'Utilisateur introuvable',
        pageClass: 'page-error',
      });
    }

    if (targetUser.id === req.currentUser.id && req.body.role !== 'admin') {
      req.flash('error', 'Vous ne pouvez pas retirer votre propre role administrateur.');
      return res.redirect(`/admin/users/${targetUser.id}/edit`);
    }

    if (targetUser.id === req.currentUser.id && req.body.status !== 'active') {
      req.flash('error', 'Vous ne pouvez pas desactiver votre propre compte.');
      return res.redirect(`/admin/users/${targetUser.id}/edit`);
    }

    if (targetUser.role === 'admin' && targetUser.status === 'active') {
      const remainingAdmins = await userStore.countActiveAdmins(targetUser.id);
      if ((req.body.role !== 'admin' || req.body.status !== 'active') && remainingAdmins === 0) {
        req.flash('error', 'Au moins un administrateur actif doit etre conserve.');
        return res.redirect(`/admin/users/${targetUser.id}/edit`);
      }
    }

    await userStore.updateUser(userId, {
      email: req.body.email,
      fullName: req.body.fullName,
      role: req.body.role,
      status: req.body.status,
      password: req.body.password || undefined,
    });

    logger.info(`[ADMIN] ${req.currentUser.email} a mis a jour l'utilisateur ${targetUser.email}`);
    req.flash('success', 'Utilisateur mis a jour.');
    return res.redirect('/admin');
  } catch (err) {
    if (err.code === 'EMAIL_ALREADY_EXISTS') {
      const editingUser = await userStore.findPublicById(userId);
      return renderView(res, 'admin/user-form', {
        title: 'Modifier un utilisateur',
        pageClass: 'page-admin',
        mode: 'edit',
        editingUser,
        formData: { ...req.body, id: userId },
        fieldErrors: { email: 'Cette adresse email est deja utilisee.' },
      }, 409);
    }

    return next(err);
  }
});

router.delete('/admin/users/:id', requireAdmin, param('id').isInt({ min: 1 }), async (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(404).render('errors/404', {
      title: 'Utilisateur introuvable',
      pageClass: 'page-error',
    });
  }

  try {
    const targetUser = await userStore.findById(Number(req.params.id));
    if (!targetUser) {
      return res.status(404).render('errors/404', {
        title: 'Utilisateur introuvable',
        pageClass: 'page-error',
      });
    }

    if (targetUser.id === req.currentUser.id) {
      req.flash('error', 'Vous ne pouvez pas supprimer votre propre compte.');
      return res.redirect('/admin');
    }

    if (targetUser.role === 'admin' && targetUser.status === 'active') {
      const remainingAdmins = await userStore.countActiveAdmins(targetUser.id);
      if (remainingAdmins === 0) {
        req.flash('error', 'Au moins un administrateur actif doit etre conserve.');
        return res.redirect('/admin');
      }
    }

    await userStore.deleteUser(targetUser.id);
    logger.info(`[ADMIN] ${req.currentUser.email} a supprime l'utilisateur ${targetUser.email}`);
    req.flash('success', 'Utilisateur supprime.');
    return res.redirect('/admin');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
