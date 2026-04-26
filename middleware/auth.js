'use strict';

function injectLocals(req, res, next) {
  res.locals.user = null;
  next();
}

module.exports = { injectLocals };
