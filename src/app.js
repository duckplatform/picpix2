const http = require("http");
const bcrypt = require("bcryptjs");
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
const flash = require("connect-flash");
const SequelizeStore = require("connect-session-sequelize")(session.Store);

const env = require("./config/env");
const logger = require("./services/logger");
const { sequelize, User } = require("./models");
const { attachCurrentUser } = require("./middleware/auth");

const indexRouter = require("./routes/index");
const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const adminRouter = require("./routes/admin");

const app = express();

app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(process.cwd(), "public")));

app.use(
  morgan("combined", {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

const sessionStore = new SequelizeStore({ db: sequelize });

app.use(
  session({
    name: "picpix2.sid",
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.nodeEnv === "production",
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use(flash());
app.use(attachCurrentUser);
app.use((req, res, next) => {
  res.locals.successMessages = req.flash("success");
  res.locals.errorMessages = req.flash("error");
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use(indexRouter);
app.use(authRouter);
app.use(profileRouter);
app.use(adminRouter);

app.use((_req, res) => {
  res.status(404).render("home", { pageTitle: "Introuvable" });
});

app.use((error, _req, res, _next) => {
  logger.error(error.stack || error.message);
  res.status(500).render("home", {
    pageTitle: "Erreur",
  });
});

const initDatabase = async () => {
  await sequelize.authenticate();
  await sequelize.sync();
  await sessionStore.sync();
};

const ensureSeedAdmin = async () => {
  const { email, password, username, fullName } = env.seedAdmin;
  if (!email || !password) {
    logger.warn("SEED_ADMIN_EMAIL ou SEED_ADMIN_PASSWORD absent, seed admin ignore.");
    return;
  }

  const [admin, created] = await User.findOrCreate({
    where: { email: email.toLowerCase() },
    defaults: {
      username,
      fullName,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin",
      isActive: true,
    },
  });

  if (!created && admin.role !== "admin") {
    admin.role = "admin";
    await admin.save();
  }
};

const startApplication = async () => {
  await initDatabase();
  await ensureSeedAdmin();

  const server = http.createServer(app);

  if (typeof PhusionPassenger !== "undefined") {
    server.listen("passenger");
    logger.info("Serveur demarre via Passenger.");
    return;
  }

  server.listen(env.port, () => {
    logger.info(`Serveur demarre sur http://localhost:${env.port}`);
  });
};

module.exports = {
  app,
  initDatabase,
  startApplication,
};

if (require.main === module) {
  startApplication().catch((error) => {
    logger.error(error.stack || error.message);
    process.exit(1);
  });
}
