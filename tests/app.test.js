'use strict';

const request = require('supertest');
const { expect } = require('chai');

const app = require('../app');
const userStore = require('../services/userStore');
const eventStore = require('../services/eventStore');

function extractCsrfToken(html) {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"/);
  if (!match) {
    throw new Error('Token CSRF introuvable dans la page');
  }

  return match[1];
}

describe('Tests applicatifs HTTP', () => {
  beforeEach(() => {
    userStore.resetTestState();
    eventStore.resetTestState();
  });

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

    it('GET /event/:token affiche la page evenement si le token existe', async () => {
      const owner = await userStore.findByEmail('admin@example.com');
      const createdEvent = await eventStore.createEvent({
        ownerUserId: owner.id,
        name: 'Concert Public',
        startsAt: '2026-09-20T20:00',
        status: 'active',
      });

      const res = await request(app).get(`/event/${createdEvent.token}`);

      expect(res.status).to.equal(200);
      expect(res.text).to.include('Concert Public');
      expect(res.text).to.include(createdEvent.token);
    });

    it('GET /event/:token retourne 404 si le token est inconnu', async () => {
      const res = await request(app).get('/event/AAAAAAAAAA');

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

  describe('Authentification et profil', () => {
    it('permet l\'inscription puis l\'acces au profil', async () => {
      const agent = request.agent(app);
      const registerPage = await agent.get('/register');
      const csrfToken = extractCsrfToken(registerPage.text);

      const registerResponse = await agent
        .post('/register')
        .type('form')
        .send({
          _csrf: csrfToken,
          fullName: 'Alice Martin',
          email: 'alice@example.com',
          password: 'SecurePass123',
          confirmPassword: 'SecurePass123',
        });

      expect(registerResponse.status).to.equal(302);
      expect(registerResponse.headers.location).to.equal('/profile');

      const profileResponse = await agent.get('/profile');
      expect(profileResponse.status).to.equal(200);
      expect(profileResponse.text).to.include('Alice Martin');
      expect(profileResponse.text).to.include('alice@example.com');
    });

    it('permet la connexion avec le compte admin par defaut', async () => {
      const agent = request.agent(app);
      const loginPage = await agent.get('/login');
      const csrfToken = extractCsrfToken(loginPage.text);

      const loginResponse = await agent
        .post('/login')
        .type('form')
        .send({
          _csrf: csrfToken,
          email: 'admin@example.com',
          password: 'Admin1234',
        });

      expect(loginResponse.status).to.equal(302);
      expect(loginResponse.headers.location).to.equal('/profile');

      const adminResponse = await agent.get('/admin');
      expect(adminResponse.status).to.equal(200);
      expect(adminResponse.text).to.include('Gestion des utilisateurs');
      expect(adminResponse.text).to.include('admin@example.com');
    });

    it('refuse l\'acces a l\'administration pour un utilisateur standard', async () => {
      const agent = request.agent(app);
      const registerPage = await agent.get('/register');
      const csrfToken = extractCsrfToken(registerPage.text);

      await agent
        .post('/register')
        .type('form')
        .send({
          _csrf: csrfToken,
          fullName: 'Bob Standard',
          email: 'bob@example.com',
          password: 'SecurePass123',
          confirmPassword: 'SecurePass123',
        })
        .expect(302);

      const adminResponse = await agent.get('/admin');
      expect(adminResponse.status).to.equal(403);
      expect(adminResponse.text).to.include('droits necessaires');
    });

    it('permet a un utilisateur de creer et consulter ses evenements depuis le profil', async () => {
      const agent = request.agent(app);
      const registerPage = await agent.get('/register');
      const registerCsrf = extractCsrfToken(registerPage.text);

      await agent
        .post('/register')
        .type('form')
        .send({
          _csrf: registerCsrf,
          fullName: 'Eva Event',
          email: 'eva@example.com',
          password: 'SecurePass123',
          confirmPassword: 'SecurePass123',
        })
        .expect(302);

      const profilePage = await agent.get('/profile');
      const profileCsrf = extractCsrfToken(profilePage.text);

      const createEventResponse = await agent
        .post('/profile/events')
        .type('form')
        .send({
          _csrf: profileCsrf,
          name: 'Festival Printemps',
          startsAt: '2026-05-01T19:30',
          status: 'active',
        });

      expect(createEventResponse.status).to.equal(302);
      expect(createEventResponse.headers.location).to.equal('/profile');

      const refreshedProfile = await agent.get('/profile');
      expect(refreshedProfile.status).to.equal(200);
      expect(refreshedProfile.text).to.include('Festival Printemps');

      const owner = await userStore.findByEmail('eva@example.com');
      const events = await eventStore.listByOwner(owner.id);
      expect(events).to.have.lengthOf(1);
      expect(events[0].uuid).to.match(/^[0-9a-f-]{36}$/i);
      expect(events[0].token).to.match(/^[A-Za-z0-9]{10}$/);
      expect(events[0].status).to.equal('active');
    });
  });

  describe('Administration utilisateurs', () => {
    async function loginAsAdmin(agent) {
      const loginPage = await agent.get('/login');
      const csrfToken = extractCsrfToken(loginPage.text);

      await agent
        .post('/login')
        .type('form')
        .send({
          _csrf: csrfToken,
          email: 'admin@example.com',
          password: 'Admin1234',
        })
        .expect(302);
    }

    it('permet le CRUD complet des utilisateurs depuis l\'administration', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);

      const createPage = await agent.get('/admin/users/new');
      const createCsrfToken = extractCsrfToken(createPage.text);

      const createResponse = await agent
        .post('/admin/users')
        .type('form')
        .send({
          _csrf: createCsrfToken,
          fullName: 'Charlie Editor',
          email: 'charlie@example.com',
          role: 'user',
          status: 'active',
          password: 'StrongPass123',
        });

      expect(createResponse.status).to.equal(302);
      expect(createResponse.headers.location).to.equal('/admin');

      const createdUser = await userStore.findByEmail('charlie@example.com');
      expect(createdUser).to.not.equal(null);

      const editPage = await agent.get(`/admin/users/${createdUser.id}/edit`);
      const editCsrfToken = extractCsrfToken(editPage.text);

      const updateResponse = await agent
        .post(`/admin/users/${createdUser.id}?_method=PUT`)
        .type('form')
        .send({
          _csrf: editCsrfToken,
          fullName: 'Charlie Manager',
          email: 'charlie.manager@example.com',
          role: 'admin',
          status: 'active',
          password: '',
        });

      expect(updateResponse.status).to.equal(302);
      expect(updateResponse.headers.location).to.equal('/admin');

      const adminPage = await agent.get('/admin');
      expect(adminPage.status).to.equal(200);
      expect(adminPage.text).to.include('charlie.manager@example.com');
      expect(adminPage.text).to.include('Charlie Manager');

      const deleteCsrfToken = extractCsrfToken(adminPage.text);
      const updatedUser = await userStore.findByEmail('charlie.manager@example.com');

      const deleteResponse = await agent
        .post(`/admin/users/${updatedUser.id}?_method=DELETE`)
        .type('form')
        .send({
          _csrf: deleteCsrfToken,
        });

      expect(deleteResponse.status).to.equal(302);
      expect(deleteResponse.headers.location).to.equal('/admin');

      const deletedUser = await userStore.findByEmail('charlie.manager@example.com');
      expect(deletedUser).to.equal(null);
    });
  });

  describe('Administration evenements', () => {
    async function loginAsAdmin(agent) {
      const loginPage = await agent.get('/login');
      const csrfToken = extractCsrfToken(loginPage.text);

      await agent
        .post('/login')
        .type('form')
        .send({
          _csrf: csrfToken,
          email: 'admin@example.com',
          password: 'Admin1234',
        })
        .expect(302);
    }

    it('permet le CRUD des evenements depuis l\'administration', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);

      const adminUser = await userStore.findByEmail('admin@example.com');

      const createPage = await agent.get('/admin/events/new');
      const createCsrf = extractCsrfToken(createPage.text);

      const createResponse = await agent
        .post('/admin/events')
        .type('form')
        .send({
          _csrf: createCsrf,
          ownerUserId: String(adminUser.id),
          name: 'Soiree Admin',
          startsAt: '2026-06-10T20:00',
          status: 'inactive',
          token: '',
        });

      expect(createResponse.status).to.equal(302);
      expect(createResponse.headers.location).to.equal('/admin');

      const eventsAfterCreate = await eventStore.listAll();
      expect(eventsAfterCreate).to.have.lengthOf(1);
      const createdEvent = eventsAfterCreate[0];
      expect(createdEvent.name).to.equal('Soiree Admin');

      const editPage = await agent.get(`/admin/events/${createdEvent.id}/edit`);
      const editCsrf = extractCsrfToken(editPage.text);

      const updateResponse = await agent
        .post(`/admin/events/${createdEvent.id}?_method=PUT`)
        .type('form')
        .send({
          _csrf: editCsrf,
          ownerUserId: String(adminUser.id),
          name: 'Soiree Admin VIP',
          startsAt: '2026-06-10T21:00',
          status: 'active',
          token: createdEvent.token,
        });

      expect(updateResponse.status).to.equal(302);
      expect(updateResponse.headers.location).to.equal('/admin');

      const adminPage = await agent.get('/admin');
      expect(adminPage.status).to.equal(200);
      expect(adminPage.text).to.include('Soiree Admin VIP');

      const deleteCsrf = extractCsrfToken(adminPage.text);
      const deleteResponse = await agent
        .post(`/admin/events/${createdEvent.id}?_method=DELETE`)
        .type('form')
        .send({
          _csrf: deleteCsrf,
        });

      expect(deleteResponse.status).to.equal(302);
      expect(deleteResponse.headers.location).to.equal('/admin');

      const eventsAfterDelete = await eventStore.listAll();
      expect(eventsAfterDelete).to.have.lengthOf(0);
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
