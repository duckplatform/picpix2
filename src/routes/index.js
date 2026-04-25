const { Router } = require("express");

const router = Router();

router.get("/", (req, res) => {
  res.render("home", {
    pageTitle: "Accueil",
  });
});

module.exports = router;
