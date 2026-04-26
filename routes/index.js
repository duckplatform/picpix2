'use strict';

const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('home', {
    title: 'Accueil',
    pageClass: 'page-home',
  });
});

module.exports = router;
