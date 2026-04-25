# Codespace setup

Ce dossier configure un environnement GitHub Codespaces pour lancer l'application.

## Services

- `app`: conteneur Node.js de développement
- `mysql`: base de données MySQL 8.4

## Bootstrap automatique

À la création du Codespace:

- `npm install` est exécuté
- `.env` est créé/ajusté automatiquement via `setup-codespace.sh`

## Démarrage de l'application

```bash
npm run dev
```

Application disponible sur le port `3000`.
