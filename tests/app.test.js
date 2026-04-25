const request = require("supertest");
const bcrypt = require("bcryptjs");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-secret";

const { app, initDatabase } = require("../src/app");
const { sequelize, User } = require("../src/models");

describe("Auth et profils", () => {
  beforeAll(async () => {
    await initDatabase();
  });

  beforeEach(async () => {
    await User.destroy({ where: {} });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test("inscription utilisateur", async () => {
    const res = await request(app).post("/register").type("form").send({
      username: "john",
      fullName: "John Doe",
      email: "john@example.com",
      password: "Password123",
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");

    const user = await User.findOne({ where: { email: "john@example.com" } });
    expect(user).toBeTruthy();
    expect(user.role).toBe("user");
  });

  test("connexion utilisateur", async () => {
    await User.create({
      username: "jane",
      fullName: "Jane Doe",
      email: "jane@example.com",
      role: "user",
      passwordHash: await bcrypt.hash("Password123", 12),
    });

    const res = await request(app).post("/login").type("form").send({
      email: "jane@example.com",
      password: "Password123",
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/profile");
  });

  test("admin protégé pour non-admin", async () => {
    const user = await User.create({
      username: "member",
      fullName: "Simple User",
      email: "member@example.com",
      role: "user",
      passwordHash: await bcrypt.hash("Password123", 12),
    });

    const agent = request.agent(app);
    await agent.post("/login").type("form").send({
      email: user.email,
      password: "Password123",
    });

    const res = await agent.get("/admin/users");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  test("admin accède à la liste utilisateurs", async () => {
    const admin = await User.create({
      username: "boss",
      fullName: "Admin Boss",
      email: "boss@example.com",
      role: "admin",
      passwordHash: await bcrypt.hash("Password123", 12),
    });

    const agent = request.agent(app);
    await agent.post("/login").type("form").send({
      email: admin.email,
      password: "Password123",
    });

    const res = await agent.get("/admin/users");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Gestion des utilisateurs");
  });
});
