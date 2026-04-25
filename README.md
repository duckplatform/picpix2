# picpix2

Application web Node.js (Express) + MySQL, compatible Passenger, avec:

- Inscription / connexion utilisateur
- Gestion de profil utilisateur
- 2 rôles: `user`, `admin`
- Interface admin CRUD pour gérer les utilisateurs
- Interface simple en Bootstrap 5

## Stack

- Node.js + Express
- Sequelize ORM
- MySQL (`mysql2`)
- Sessions serveur (`express-session` + `connect-session-sequelize`)
- Templates EJS + Bootstrap
- Sécurité: Helmet, hash bcrypt, rate-limit login/register, validations serveur
- Logs: Morgan + Winston dans `logs/`

## Prérequis

- Node.js 20+
- MySQL 8+

## Installation

1. Installer les dépendances:

	npm install

2. Créer le fichier d'environnement:

	cp .env.example .env

3. Renseigner au minimum les variables DB et `SESSION_SECRET` dans `.env`.

4. Démarrer en développement:

	npm run dev

5. Ouvrir:

	http://localhost:3000

## Lancement avec GitHub Codespaces

Le projet contient une configuration prête à l'emploi dans [`.devcontainer/`](.devcontainer/README.md).

À la création du Codespace:

- un service MySQL est démarré automatiquement
- les dépendances Node.js sont installées
- le fichier `.env` est créé/mis à jour pour pointer vers MySQL (`DB_HOST=mysql`)

Puis lancer l'application:

	npm run dev

## Variables d'environnement

Voir `.env.example`.

Variables importantes:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `SESSION_SECRET`
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (création admin auto au démarrage)

## Scripts

- `npm run dev`: mode développement
- `npm start`: mode production
- `npm test`: tests automatisés

## Déploiement Passenger (cPanel / VPS)

1. Installer les dépendances en production:

	npm ci --omit=dev

2. Configurer l'application Node.js dans Passenger:

- Startup file: `src/app.js`
- Node version: 20+
- Variables d'environnement: celles du `.env.example`

3. Redémarrer l'application via l'interface Passenger.

## Architecture

- `src/app.js`: configuration Express + point d'entrée runtime (init DB, seed admin, compat Passenger)
- `src/models/`: modèles Sequelize
- `src/routes/`: routes auth/profile/admin
- `src/middleware/`: auth et validations
- `views/`: templates EJS Bootstrap
- `public/css/`: styles statiques
- `tests/`: tests Jest + Supertest

## Sécurité appliquée

- Hash de mot de passe avec bcrypt
- Session HTTPOnly, SameSite et durée limitée
- Rate limiting sur endpoints d'authentification
- Validation stricte des entrées (serveur)
- Contrôle d'accès par rôle (`admin`)

## Monitoring et logs

- Endpoint santé: `GET /health`
- Logs applicatifs: `logs/combined.log`
- Logs erreurs: `logs/error.log`

## Parcours utilisateur

- Un visiteur peut créer un compte via `/register`
- Connexion via `/login`
- Profil personnel via `/profile`
- Un admin peut gérer les utilisateurs via `/admin/users`