'use strict';

const request = require('supertest');
const { expect } = require('chai');

const app = require('../app');

describe('Tests applicatifs HTTP', () => {
  describe('Pages publiques', () => {
    it('GET / retourne 200 et le contenu de la page accueil', async () => {
      const res = await request(app).get('/');

      expect(res.status).to.equal(200);
      expect(res.text).to.include('Bienvenue sur PicPix2');
      expect(res.headers['content-type']).to.match(/text\/html/);
    });

    it('GET /styles.css retourne 200', async () => {
      const res = await request(app).get('/styles.css');

      expect(res.status).to.equal(200);
      expect(res.headers['content-type']).to.match(/text\/css/);
    });

    it('GET /inconnu retourne 404', async () => {
      const res = await request(app).get('/inconnu');

      expect(res.status).to.equal(404);
      expect(res.text).to.include('La page demandee est introuvable');
    });
  });

  describe('Monitoring', () => {
    it('GET /health retourne un statut OK en environnement de test', async () => {
      const res = await request(app).get('/health');

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({
        status: 'ok',
        database: 'up',
      });
    });
  });

  describe('Mode degrade (DB indisponible)', () => {
    let previousDatabaseReady;

    beforeEach(() => {
      previousDatabaseReady = app.locals.databaseReady;
    });

    afterEach(() => {
      app.locals.databaseReady = previousDatabaseReady;
    });

    it('la page accueil reste accessible', async () => {
      app.locals.databaseReady = false;

      const res = await request(app).get('/');

      expect(res.status).to.equal(200);
      expect(res.text).to.include('Bienvenue sur PicPix2');
    });

    it('les autres pages retournent 503', async () => {
      app.locals.databaseReady = false;

      const res = await request(app).get('/inconnu');

      expect(res.status).to.equal(503);
      expect(res.text).to.include('Service temporairement indisponible');
    });
  });
});
